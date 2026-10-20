import { z } from 'zod';

export const DAY = 86_400_000;
export const difficultyInfo = {
  easy: { label: '简单', boss: 'slime', name: '森林史莱姆', level: 5, exp: 50 },
  normal: { label: '普通', boss: 'skeleton', name: '骷髅法师', level: 10, exp: 100 },
  hard: { label: '困难', boss: 'knight', name: '深渊骑士', level: 15, exp: 150 },
} as const;
export const bossNames = { knight: '深渊骑士', slime: '森林史莱姆', skeleton: '骷髅法师' };
const idSchema = z.string().min(1).max(100);
const timeSchema = z.number().finite().min(0).max(8_640_000_000_000_000);
export const subTaskSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
  weight: z.number().finite().min(1).max(1000),
  completed: z.boolean(),
  completedAt: timeSchema.optional(),
});
export const taskInputSchema = z
  .object({
    title: z.string().trim().min(1, '请输入任务名称').max(100),
    deadline: timeSchema,
    difficulty: z.enum(['easy', 'normal', 'hard']),
    bossType: z.enum(['knight', 'slime', 'skeleton']),
    notes: z.string().max(2000),
    subTasks: z.array(subTaskSchema).min(1).max(100),
  })
  .refine((t) => new Set(t.subTasks.map((s) => s.id)).size === t.subTasks.length, '子任务 ID 重复');
export const taskSchema = taskInputSchema.safeExtend({
  id: idSchema,
  createdAt: timeSchema,
  defeatedAt: timeSchema.optional(),
  rewardClaimed: z.boolean(),
  sample: z.boolean().optional(),
});
export const settingsSchema = z.object({
  floatingEnabled: z.boolean(),
  alwaysOnTop: z.boolean(),
  launchAtStartup: z.boolean(),
  soundEnabled: z.boolean(),
  floatingScale: z.number().min(0.6).max(1.6),
  closeToTray: z.boolean(),
});
export const recordSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  title: z.string().max(100),
  bossType: z.enum(['knight', 'slime', 'skeleton']),
  difficulty: z.enum(['easy', 'normal', 'hard']),
  createdAt: timeSchema,
  deadline: timeSchema,
  defeatedAt: timeSchema,
  exp: z.number().int().min(0).max(180),
  result: z.enum(['early', 'ontime', 'clutch', 'overdue']),
  sample: z.boolean().optional(),
});
export const activitySchema = z.object({
  id: idSchema,
  taskId: idSchema,
  title: z.string().max(300),
  type: z.enum(['create', 'attack', 'undo', 'defeat', 'edit']),
  at: timeSchema,
  damage: z.number().int().min(-1000).max(1000).optional(),
});
export const appDataSchema = z
  .object({
    version: z.literal(1),
    tasks: z.array(taskSchema).max(10000),
    records: z.array(recordSchema).max(10000),
    activities: z.array(activitySchema).max(500),
    settings: settingsSchema,
    floatingPosition: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.tasks.map((t) => t.id)).size !== data.tasks.length)
      ctx.addIssue({ code: 'custom', message: '任务 ID 重复' });
    if (new Set(data.records.map((r) => r.taskId)).size !== data.records.length)
      ctx.addIssue({ code: 'custom', message: '结算记录重复' });
    for (const task of data.tasks) {
      if (!!task.defeatedAt !== task.subTasks.every((s) => s.completed))
        ctx.addIssue({ code: 'custom', message: '任务完成状态不一致' });
      if (data.records.some((r) => r.taskId === task.id) && !task.rewardClaimed)
        ctx.addIssue({ code: 'custom', message: '任务奖励状态不一致' });
    }
  });
export type Difficulty = keyof typeof difficultyInfo;
export type BossType = keyof typeof bossNames;
export type SubTask = z.infer<typeof subTaskSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type BossTask = z.infer<typeof taskSchema>;
export type AppSettings = z.infer<typeof settingsSchema>;
export type AppData = z.infer<typeof appDataSchema>;
export type BattleRecord = z.infer<typeof recordSchema>;
export type Activity = z.infer<typeof activitySchema>;
export const defaultSettings: AppSettings = {
  floatingEnabled: true,
  alwaysOnTop: true,
  launchAtStartup: false,
  soundEnabled: false,
  floatingScale: 1,
  closeToTray: true,
};
export const uid = () => crypto.randomUUID();

export function hp(task: Pick<BossTask, 'subTasks'>): number {
  const total = task.subTasks.reduce((n, s) => n + s.weight, 0);
  const done = task.subTasks.reduce((n, s) => n + (s.completed ? s.weight : 0), 0);
  if (!total) return 1000;
  // An incomplete task must never round down to zero HP.
  return task.subTasks.every((s) => s.completed)
    ? 0
    : Math.max(1, Math.round(1000 * (1 - done / total)));
}
export function status(task: BossTask, now = Date.now()) {
  if (task.subTasks.every((s) => s.completed)) return 'defeated';
  if (task.deadline <= now) return 'overdue';
  if (task.deadline - now <= DAY) return 'rage';
  if (task.deadline - now <= 3 * DAY) return 'urgent';
  return 'active';
}
export const statusLabels = {
  defeated: '已击败',
  overdue: '已逾期',
  rage: '狂暴',
  urgent: '紧急',
  active: '进行中',
};
export function timeLeft(deadline: number, now = Date.now()): string {
  const diff = deadline - now;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / DAY);
  const hours = Math.floor(abs / 3_600_000);
  const mins = Math.max(1, Math.ceil(abs / 60_000));
  const text =
    days >= 1
      ? `${days} 天${Math.floor((abs % DAY) / 3_600_000) ? ` ${Math.floor((abs % DAY) / 3_600_000)} 小时` : ''}`
      : hours >= 1
        ? `${hours} 小时 ${Math.floor((abs % 3_600_000) / 60_000)} 分钟`
        : `${mins} 分钟`;
  return diff <= 0 ? `已逾期 ${text}` : `剩余 ${text}`;
}
export const resultLabels = {
  early: '提前击败',
  ontime: '准时击败',
  clutch: '极限反杀',
  overdue: '逾期完成',
};
export function settlement(task: BossTask, now: number): BattleRecord {
  const left = task.deadline - now;
  const result =
    left < 0 ? 'overdue' : left > DAY ? 'early' : left <= 3_600_000 ? 'clutch' : 'ontime';
  return {
    id: uid(),
    taskId: task.id,
    title: task.title,
    bossType: task.bossType,
    difficulty: task.difficulty,
    createdAt: task.createdAt,
    deadline: task.deadline,
    defeatedAt: now,
    exp: difficultyInfo[task.difficulty].exp + (result === 'early' ? 30 : 0),
    result,
    sample: task.sample,
  };
}
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create'), input: taskInputSchema }),
  z.object({ type: z.literal('edit'), id: idSchema, input: taskInputSchema }),
  z.object({ type: z.literal('toggle'), id: idSchema, subId: idSchema }),
  z.object({
    type: z.literal('addSub'),
    id: idSchema,
    title: z.string().trim().min(1).max(200),
    weight: z.number().min(1).max(1000),
  }),
  z.object({ type: z.literal('delete'), id: idSchema, removeRecord: z.boolean() }),
  z.object({ type: z.literal('settings'), settings: settingsSchema.partial() }),
  z.object({ type: z.literal('clearSamples') }),
]);
export type Command = z.infer<typeof commandSchema>;

/** Pure transaction shared by the Electron main process and browser preview. */
export function applyCommand(data: AppData, raw: Command, now = Date.now()): AppData {
  const cmd = commandSchema.parse(raw);
  const next = structuredClone(data);
  const addLog = (taskId: string, title: string, type: Activity['type'], damage?: number) => {
    next.activities.unshift({ id: uid(), taskId, title, type, at: now, damage });
    next.activities = next.activities.slice(0, 500);
  };
  if (cmd.type === 'settings') {
    next.settings = { ...next.settings, ...cmd.settings };
    return next;
  }
  if (cmd.type === 'clearSamples') {
    const ids = new Set(next.tasks.filter((t) => t.sample).map((t) => t.id));
    next.tasks = next.tasks.filter((t) => !t.sample);
    next.records = next.records.filter((r) => !r.sample);
    next.activities = next.activities.filter((a) => !ids.has(a.taskId));
    return next;
  }
  if (cmd.type === 'create') {
    const task: BossTask = {
      ...cmd.input,
      id: uid(),
      createdAt: now,
      rewardClaimed: false,
      subTasks: cmd.input.subTasks.map((s) => ({ ...s, completed: false, completedAt: undefined })),
    };
    next.tasks.push(task);
    addLog(task.id, `召唤了 Boss「${task.title}」`, 'create');
    return next;
  }
  const task = next.tasks.find((t) => t.id === cmd.id);
  if (!task) throw new Error('任务不存在，可能已在另一个窗口删除');
  if (cmd.type === 'delete') {
    next.tasks = next.tasks.filter((t) => t.id !== cmd.id);
    if (cmd.removeRecord) next.records = next.records.filter((r) => r.taskId !== cmd.id);
    next.activities = next.activities.filter((a) => a.taskId !== cmd.id);
    return next;
  }
  const before = hp(task);
  if (cmd.type === 'edit') {
    Object.assign(task, cmd.input);
    addLog(task.id, `更新了「${task.title}」`, 'edit');
  } else if (cmd.type === 'addSub') {
    if (task.subTasks.length >= 100) throw new Error('每个 DDL 最多包含 100 个子任务');
    task.subTasks.push({ id: uid(), title: cmd.title, weight: cmd.weight, completed: false });
    addLog(task.id, `添加了「${cmd.title}」`, 'edit');
  } else if (cmd.type === 'toggle') {
    const sub = task.subTasks.find((s) => s.id === cmd.subId);
    if (!sub) throw new Error('子任务不存在');
    sub.completed = !sub.completed;
    sub.completedAt = sub.completed ? now : undefined;
    addLog(
      task.id,
      `${sub.completed ? '完成了' : '撤销了'}「${sub.title}」`,
      sub.completed ? 'attack' : 'undo',
      before - hp(task),
    );
  }
  if (task.subTasks.every((s) => s.completed)) {
    task.defeatedAt ??= now;
    if (!task.rewardClaimed) {
      const record = settlement(task, now);
      next.records.unshift(record);
      task.rewardClaimed = true;
      addLog(task.id, `击败了「${task.title}」 · +${record.exp} EXP`, 'defeat');
    }
  } else task.defeatedAt = undefined;
  return next;
}

export function seedData(now = Date.now()): AppData {
  const make = (
    id: string,
    title: string,
    difficulty: Difficulty,
    days: number,
    titles: string[],
    completed: number,
  ): BossTask => ({
    id,
    title,
    difficulty,
    bossType: difficultyInfo[difficulty].boss,
    deadline: now + days * DAY,
    createdAt: now - 5 * DAY,
    notes: '',
    rewardClaimed: false,
    sample: true,
    subTasks: titles.map((title, i) => ({
      id: `${id}-${i}`,
      title,
      weight: 1,
      completed: i < completed,
      completedAt: i < completed ? now - (i + 1) * 3_600_000 : undefined,
    })),
  });
  const knight = make(
    'sample-knight',
    '数据结构课程设计',
    'hard',
    2.9,
    [
      '确定选题和需求分析',
      '完成数据结构设计',
      '实现核心代码模块',
      '完成测试与文档',
      '提交最终报告',
    ],
    2,
  );
  const slime = make(
    'sample-slime',
    '英语期末论文',
    'easy',
    6,
    ['查阅文献与选题', '完成论文初稿', '修改与润色', '提交最终论文'],
    2,
  );
  const skeleton = make(
    'sample-skeleton',
    '产品需求文档',
    'normal',
    8,
    ['用户调研', '梳理核心需求', '绘制原型', '完成需求评审'],
    1,
  );
  const done = make('sample-done', '健身计划', 'easy', 1, ['完成本周训练', '记录训练成果'], 2);
  done.defeatedAt = now - DAY;
  done.rewardClaimed = true;
  const record = settlement(done, now - DAY);
  return {
    version: 1,
    tasks: [knight, slime, skeleton, done],
    records: [record],
    settings: { ...defaultSettings },
    activities: [
      {
        id: uid(),
        taskId: knight.id,
        title: '完成了「完成数据结构设计」',
        type: 'attack',
        damage: 200,
        at: now - 2 * 3_600_000,
      },
      {
        id: uid(),
        taskId: knight.id,
        title: '完成了「确定选题和需求分析」',
        type: 'attack',
        damage: 200,
        at: now - DAY,
      },
      {
        id: uid(),
        taskId: knight.id,
        title: '召唤了 Boss「数据结构课程设计」',
        type: 'create',
        at: now - 5 * DAY,
      },
    ],
  };
}

const quotes = {
  active: ['就凭你，也想在截止前完成？', '计划写得不错，行动呢？', '我已经准备好，你呢？'],
  urgent: ['还不写？\n就这点进度也想打败我？', '截止日期可不会等你。', '再拖下去，我可要升级了。'],
  rage: ['时间不多了！\n你还敢开新坑？', '我开始狂暴了，你开始了吗？', '别看我了，快去做任务！'],
  overdue: ['时间到了。\n但现在开始，也不算太晚。', '逾期不等于放弃，再来！'],
  low: ['不是哥们，能不能休息一下？', '求你了，去刷会短视频吧！', '你今天怎么这么认真？！'],
  defeated: ['这次算你赢了。\n下一个 DDL 见！', '好吧，你才是真正的 Boss。'],
};
export function quote(task: BossTask, now: number, index = 0) {
  const s = status(task, now);
  const pool =
    s === 'defeated'
      ? quotes.defeated
      : hp(task) <= 250
        ? quotes.low
        : quotes[
            s === 'overdue'
              ? 'overdue'
              : s === 'rage'
                ? 'rage'
                : s === 'urgent'
                  ? 'urgent'
                  : 'active'
          ];
  return pool[index % pool.length];
}
