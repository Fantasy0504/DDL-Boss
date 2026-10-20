import { describe, it, expect } from 'vitest';
import {
  DAY,
  appDataSchema,
  applyCommand,
  hp,
  seedData,
  settlement,
  status,
  timeLeft,
  type AppData,
} from '../shared/domain';
const now = new Date('2026-10-20T12:00:00+08:00').getTime();
const fresh = () => seedData(now);
describe('derived battle state', () => {
  it('uses weighted completion and reverses exactly', () => {
    let data = fresh();
    const task = data.tasks[0];
    task.subTasks = [20, 40, 25, 15].map((weight, i) => ({
      id: `s${i}`,
      title: `子任务 ${i}`,
      weight,
      completed: i < 2,
    }));
    expect(hp(task)).toBe(400);
    data = applyCommand(data, { type: 'toggle', id: task.id, subId: 's0' }, now);
    expect(hp(data.tasks[0])).toBe(600);
    data = applyCommand(data, { type: 'toggle', id: task.id, subId: 's0' }, now);
    expect(hp(data.tasks[0])).toBe(400);
  });
  it('does not report zero HP when a small weighted task remains', () => {
    const task = fresh().tasks[0];
    task.subTasks = Array.from({ length: 99 }, (_, i) => ({
      id: `${i}`,
      title: 'task',
      weight: 1000,
      completed: true,
    }));
    task.subTasks.push({ id: 'last', title: 'last', weight: 1, completed: false });
    expect(hp(task)).toBe(1);
  });
  it('derives urgency and overdue at exact time boundaries', () => {
    const task = fresh().tasks[0];
    task.deadline = now + 3 * DAY + 1;
    expect(status(task, now)).toBe('active');
    task.deadline--;
    expect(status(task, now)).toBe('urgent');
    task.deadline = now + DAY;
    expect(status(task, now)).toBe('rage');
    task.deadline = now;
    expect(status(task, now)).toBe('overdue');
    task.subTasks.forEach((s) => {
      s.completed = true;
    });
    expect(status(task, now)).toBe('defeated');
  });
  it('handles cross-day and overdue countdowns', () => {
    expect(timeLeft(now + DAY + 3_600_000, now)).toBe('剩余 1 天 1 小时');
    expect(timeLeft(now - 2 * 3_600_000, now)).toBe('已逾期 2 小时 0 分钟');
    expect(timeLeft(now + 1, now)).toBe('剩余 1 分钟');
  });
});
describe('transactions and settlement', () => {
  it('settles once, even after reopening and defeating again', () => {
    let data = fresh();
    const task = data.tasks[0];
    const subs = task.subTasks.filter((s) => !s.completed);
    for (const sub of subs)
      data = applyCommand(data, { type: 'toggle', id: task.id, subId: sub.id }, now);
    expect(hp(data.tasks[0])).toBe(0);
    expect(data.tasks[0].defeatedAt).toBe(now);
    expect(data.records.filter((r) => r.taskId === task.id)).toHaveLength(1);
    expect(data.records[0].exp).toBe(180);
    data = applyCommand(data, { type: 'toggle', id: task.id, subId: subs[0].id }, now + 1);
    expect(data.tasks[0].defeatedAt).toBeUndefined();
    expect(hp(data.tasks[0])).toBe(200);
    data = applyCommand(data, { type: 'toggle', id: task.id, subId: subs[0].id }, now + 2);
    expect(data.records.filter((r) => r.taskId === task.id)).toHaveLength(1);
    expect(data.records[0].defeatedAt).toBe(now);
  });
  it('awards early, on-time, clutch and overdue outcomes', () => {
    const task = fresh().tasks[0];
    task.deadline = now + DAY + 1;
    expect(settlement(task, now)).toMatchObject({ exp: 180, result: 'early' });
    task.deadline = now + DAY;
    expect(settlement(task, now)).toMatchObject({ exp: 150, result: 'ontime' });
    task.deadline = now + 3_600_000;
    expect(settlement(task, now).result).toBe('clutch');
    task.deadline = now - 1;
    expect(settlement(task, now).result).toBe('overdue');
  });
  it('creates quick tasks uncompleted even if input is completed', () => {
    const data = fresh();
    const { title, deadline, difficulty, bossType, notes } = data.tasks[0];
    const next = applyCommand(
      data,
      {
        type: 'create',
        input: {
          title,
          deadline,
          difficulty,
          bossType,
          notes,
          subTasks: [{ id: 'one', title: 'do it', weight: 1, completed: true }],
        },
      },
      now,
    );
    expect(hp(next.tasks.at(-1)!)).toBe(1000);
    expect(next.tasks.at(-1)!.sample).toBeUndefined();
  });
  it('recalculates after adding a subtask to a defeated task', () => {
    const data = fresh();
    const task = data.tasks.at(-1)!;
    const next = applyCommand(
      data,
      { type: 'addSub', id: task.id, title: 'new step', weight: 2 },
      now,
    );
    expect(hp(next.tasks.at(-1)!)).toBe(500);
    expect(next.tasks.at(-1)!.defeatedAt).toBeUndefined();
    expect(next.tasks.at(-1)!.rewardClaimed).toBe(true);
  });
  it('retains history by default on deletion and can remove it explicitly', () => {
    const data = fresh();
    const task = data.tasks.at(-1)!;
    expect(
      applyCommand(data, { type: 'delete', id: task.id, removeRecord: false }, now).records,
    ).toHaveLength(1);
    expect(
      applyCommand(data, { type: 'delete', id: task.id, removeRecord: true }, now).records,
    ).toHaveLength(0);
  });
  it('clears sample tasks while preserving user-created tasks', () => {
    const data = fresh();
    const task = { ...structuredClone(data.tasks[0]), id: 'user-task', sample: false };
    data.tasks.push(task);
    const next = applyCommand(data, { type: 'clearSamples' }, now);
    expect(next.tasks.map((t) => t.id)).toEqual(['user-task']);
    expect(next.records).toHaveLength(0);
  });
  it('rejects invalid weights, empty titles and duplicate IDs', () => {
    const data = fresh();
    expect(() =>
      applyCommand(data, { type: 'addSub', id: data.tasks[0].id, title: ' ', weight: 0 }, now),
    ).toThrow();
    data.tasks.push(structuredClone(data.tasks[0]));
    expect(appDataSchema.safeParse(data).success).toBe(false);
    const other = fresh();
    other.records.push(structuredClone(other.records[0]));
    expect(appDataSchema.safeParse(other).success).toBe(false);
  });
  it('rejects inconsistent imported completion and reward states', () => {
    const data = fresh();
    data.tasks[0].defeatedAt = now;
    expect(appDataSchema.safeParse(data).success).toBe(false);
    const other = fresh();
    other.tasks.at(-1)!.rewardClaimed = false;
    expect(appDataSchema.safeParse(other).success).toBe(false);
  });
  it('never mutates its input', () => {
    const data = fresh();
    const snapshot = JSON.stringify(data);
    applyCommand(
      data,
      { type: 'toggle', id: data.tasks[0].id, subId: data.tasks[0].subTasks[2].id },
      now,
    );
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});
