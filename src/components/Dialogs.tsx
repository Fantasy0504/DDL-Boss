import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, X, Trash2, Swords, ChevronRight, Trophy } from 'lucide-react';
import {
  bossNames,
  difficultyInfo,
  hp,
  resultLabels,
  uid,
  type BossTask,
  type BossType,
  type Difficulty,
  type TaskInput,
} from '../../shared/domain';
import { useStore } from '../store';
import Sprite from './Sprite';

export function Modal({
  children,
  title,
  onClose,
  className = '',
}: {
  children: ReactNode;
  title: string;
  onClose(): void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (
      ref.current?.querySelector<HTMLElement>(
        'input:not(:disabled),textarea:not(:disabled),select:not(:disabled)',
      ) ?? ref.current?.querySelector<HTMLElement>('button:not(:disabled)')
    )?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const items = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ) ?? []),
        ];
        if (event.shiftKey && document.activeElement === items[0]) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
          event.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${className}`}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="关闭弹窗" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function localInput(time: number) {
  const d = new Date(time);
  return new Date(time - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function TaskDialog({ task, onClose }: { task?: BossTask; onClose(): void }) {
  const [mode, setMode] = useState<'quick' | 'full'>(task ? 'full' : 'quick');
  const [title, setTitle] = useState(task?.title ?? '');
  const [deadline, setDeadline] = useState(
    localInput(task?.deadline ?? Date.now() + 3 * 86_400_000),
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(task?.difficulty ?? 'normal');
  const [boss, setBoss] = useState<BossType>(task?.bossType ?? 'skeleton');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [subs, setSubs] = useState(
    task?.subTasks ?? [{ id: uid(), title: '', weight: 1, completed: false }],
  );
  const [error, setError] = useState('');
  const pending = useStore((s) => s.pending);
  const execute = useStore((s) => s.execute);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !deadline || !Number.isFinite(new Date(deadline).getTime())) {
      setError('请填写任务名称和有效截止时间');
      return;
    }
    if (
      mode === 'full' &&
      subs.some((s) => !s.title.trim() || !Number.isFinite(s.weight) || s.weight < 1)
    ) {
      setError('请填写每个子任务，并设置大于 0 的权重');
      return;
    }
    const input: TaskInput = {
      title: title.trim(),
      deadline: new Date(deadline).getTime(),
      difficulty,
      bossType: boss,
      notes,
      subTasks:
        mode === 'quick'
          ? [{ id: uid(), title: title.trim(), weight: 1, completed: false }]
          : subs.map((s) => ({ ...s, title: s.title.trim() })),
    };
    const result = await execute(
      task ? { type: 'edit', id: task.id, input } : { type: 'create', input },
    );
    if (result) onClose();
  }
  return (
    <Modal title={task ? '编辑 DDL' : '召唤一位新 Boss'} onClose={onClose} className="create-modal">
      <form onSubmit={save}>
        {!task && (
          <div className="mode-tabs">
            <button
              type="button"
              className={mode === 'quick' ? 'selected' : ''}
              onClick={() => setMode('quick')}
            >
              快速创建
            </button>
            <button
              type="button"
              className={mode === 'full' ? 'selected' : ''}
              onClick={() => setMode('full')}
            >
              完整创建
            </button>
          </div>
        )}
        <p className="form-intro">
          {mode === 'quick'
            ? '一个 DDL，一位 Boss。完成任务，就能一击制胜。'
            : '把大目标拆成小任务，每一次完成都是一次攻击。'}
        </p>
        {task?.rewardClaimed && (
          <p className="notice">这个任务已结算过奖励。修改后不会重复获得经验。</p>
        )}
        <label className="field">
          任务名称 <span>*</span>
          <input
            autoFocus
            placeholder="这次要打败什么 DDL？"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <div className="form-columns">
          <label className="field">
            截止日期与时间 <span>*</span>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </label>
          <label className="field">
            任务难度
            <select
              value={difficulty}
              onChange={(e) => {
                const d = e.target.value as Difficulty;
                setDifficulty(d);
                setBoss(difficultyInfo[d].boss);
              }}
            >
              <option value="easy">简单 · 50 EXP</option>
              <option value="normal">普通 · 100 EXP</option>
              <option value="hard">困难 · 150 EXP</option>
            </select>
          </label>
        </div>
        <label className="field-label">
          Boss 外观 <span className="muted">所有 Boss 均为 1000 HP</span>
        </label>
        <div className="boss-picker">
          {(Object.keys(bossNames) as BossType[]).map((type) => (
            <button
              type="button"
              key={type}
              className={boss === type ? 'selected' : ''}
              onClick={() => setBoss(type)}
            >
              <Sprite type={type} />
              <span>{bossNames[type]}</span>
            </button>
          ))}
        </div>
        {mode === 'full' && (
          <div className="subtask-fields">
            <div className="section-heading">
              <label className="field-label">
                子任务 <span className="muted">权重决定伤害比例</span>
              </label>
              <span className="muted">{subs.length} / 100</span>
            </div>
            <div className="subtask-field-header">
              <span>子任务名称</span>
              <span>权重</span>
            </div>
            {subs.map((s, i) => (
              <div className="subtask-field" key={s.id}>
                <input
                  aria-label={`子任务 ${i + 1}`}
                  value={s.title}
                  maxLength={200}
                  placeholder={`例如：${['完成资料收集', '写出第一版', '检查并提交'][i % 3]}`}
                  onChange={(e) =>
                    setSubs(subs.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))
                  }
                  required
                />
                <input
                  aria-label={`权重 ${i + 1}`}
                  type="number"
                  min="1"
                  max="1000"
                  value={s.weight || ''}
                  onChange={(e) =>
                    setSubs(
                      subs.map((x) =>
                        x.id === s.id ? { ...x, weight: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  required
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`删除子任务 ${i + 1}`}
                  disabled={subs.length === 1}
                  onClick={() => setSubs(subs.filter((x) => x.id !== s.id))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              disabled={subs.length >= 100}
              onClick={() =>
                setSubs([...subs, { id: uid(), title: '', weight: 1, completed: false }])
              }
            >
              <Plus size={16} />
              添加子任务
            </button>
          </div>
        )}
        <label className="field">
          备注 <span className="muted">选填</span>
          <textarea
            placeholder="给未来的自己留点线索……"
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <footer className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="button" disabled={pending}>
            <Swords size={18} />
            {pending ? '保存中…' : task ? '保存修改' : '召唤 Boss'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export interface ConfirmState {
  title: string;
  message: string;
  action(): void | Promise<void>;
  danger?: boolean;
  recordOption?: boolean;
}
export function ConfirmDialog({
  value,
  onClose,
  onRecordOption,
}: {
  value: ConfirmState;
  onClose(): void;
  onRecordOption?(checked: boolean): void;
}) {
  return (
    <Modal title={value.title} onClose={onClose} className="confirm-modal">
      <p className="confirm-message">{value.message}</p>
      {value.recordOption && (
        <label className="check-option">
          <input type="checkbox" onChange={(e) => onRecordOption?.(e.target.checked)} />
          同时删除这位 Boss 的图鉴记录
        </label>
      )}
      <footer className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          取消
        </button>
        <button
          className={`button ${value.danger ? 'danger' : ''}`}
          onClick={() => {
            void value.action();
            onClose();
          }}
        >
          确认{value.danger ? '删除' : '继续'}
        </button>
      </footer>
    </Modal>
  );
}
export function AddSubDialog({ task, onClose }: { task: BossTask; onClose(): void }) {
  const [title, setTitle] = useState('');
  const [weight, setWeight] = useState(1);
  const execute = useStore((s) => s.execute);
  const pending = useStore((s) => s.pending);
  return (
    <Modal title="添加子任务" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await execute({ type: 'addSub', id: task.id, title, weight });
          if (result) onClose();
        }}
      >
        <p className="form-intro">
          新增子任务后，Boss HP 将按权重重新计算。
          {hp(task) === 0 ? '已结算的奖励不会重复发放。' : ''}
        </p>
        <label className="field">
          子任务名称
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="把下一步写下来"
          />
        </label>
        <label className="field">
          权重
          <input
            type="number"
            min="1"
            max="1000"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            required
          />
        </label>
        <footer className="modal-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="button" disabled={pending}>
            添加子任务
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function VictoryDialog() {
  const record = useStore((s) => s.victory);
  const dismiss = useStore((s) => s.dismissVictory);
  if (!record) return null;
  const next = () => {
    dismiss();
    const state = useStore.getState();
    const task = state.data?.tasks
      .filter((t) => !t.defeatedAt)
      .sort((a, b) => a.deadline - b.deadline)[0];
    if (task) state.select(task.id);
  };
  return (
    <Modal title="挑战完成" onClose={dismiss} className="victory-modal">
      <div className="victory-mark">
        <Trophy size={23} /> BOSS DEFEATED
      </div>
      <Sprite type={record.bossType} />
      <h2>DDL，被你打败了。</h2>
      <p>「{record.title}」已收入 Boss 图鉴</p>
      <div className="reward">
        <span>{resultLabels[record.result]}</span>
        <strong>
          +{record.exp} <small>EXP</small>
        </strong>
      </div>
      <p className="muted">每完成一个任务，你就更强大一点。</p>
      <button className="button" onClick={next}>
        继续下一场战斗
        <ChevronRight size={18} />
      </button>
    </Modal>
  );
}
