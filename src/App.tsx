import { useEffect, useRef, useState } from 'react';
import {
  House,
  ClipboardList,
  Skull,
  Trophy,
  ChartNoAxesColumnIncreasing,
  Settings,
  Plus,
  Swords,
  CalendarDays,
  MoreHorizontal,
  Check,
  ChevronRight,
  CircleCheck,
  Sword,
  Sparkles,
  Clock3,
  Search,
  Pencil,
  Trash2,
  X,
  Minus,
  Square,
  ShieldCheck,
  Play,
  Download,
  Upload,
  Monitor,
  Volume2,
  HardDrive,
  Flag,
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  Eye,
  PanelTop,
  RotateCcw,
} from 'lucide-react';
import {
  bossNames,
  difficultyInfo,
  hp,
  quote,
  resultLabels,
  status,
  statusLabels,
  timeLeft,
  type AppSettings,
  type BossTask,
} from '../shared/domain';
import { initialize, useStore, type Page } from './store';
import { dateText, relativeText, useClock } from './hooks';
import Sprite from './components/Sprite';
import {
  AddSubDialog,
  ConfirmDialog,
  TaskDialog,
  VictoryDialog,
  type ConfirmState,
} from './components/Dialogs';

const nav = [
  { id: 'home', label: '首页', Icon: House },
  { id: 'tasks', label: '任务列表', Icon: ClipboardList },
  { id: 'bestiary', label: 'Boss 图鉴', Icon: Skull },
  { id: 'achievements', label: '成就', Icon: Trophy },
  { id: 'stats', label: '数据统计', Icon: ChartNoAxesColumnIncreasing },
  { id: 'settings', label: '设置', Icon: Settings },
] as const;
type Filter = 'all' | 'active' | 'defeated' | 'overdue';
function filterTasks(tasks: BossTask[], filter: Filter, now: number, search = '') {
  return tasks
    .filter(
      (t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) &&
        (filter === 'all' || filter === 'defeated'
          ? filter === 'all' || !!t.defeatedAt
          : filter === 'active'
            ? !t.defeatedAt && t.deadline > now
            : !t.defeatedAt && t.deadline <= now),
    )
    .sort((a, b) => Number(!!a.defeatedAt) - Number(!!b.defeatedAt) || a.deadline - b.deadline);
}
function Badge({ task, now }: { task: BossTask; now: number }) {
  const s = status(task, now);
  return <span className={`badge ${s}`}>{statusLabels[s]}</span>;
}
function Bar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div
      className={`bar ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${value}%` }} />
    </div>
  );
}

export default function App() {
  const data = useStore((s) => s.data);
  const page = useStore((s) => s.page);
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const pending = useStore((s) => s.pending);
  const demo = useStore((s) => s.demo);
  const [editing, setEditing] = useState<BossTask | 'new' | null>(null);
  const [adding, setAdding] = useState<BossTask | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const removeRecord = useRef(false);
  const now = useClock();
  useEffect(() => {
    void initialize();
  }, []);
  function edit(task: BossTask) {
    if (task.rewardClaimed)
      setConfirm({
        title: '编辑已结算的任务？',
        message: '修改子任务可能使 Boss 重新出现。已领取的经验不会重复发放。',
        action: () => setEditing(task),
      });
    else setEditing(task);
  }
  function remove(task: BossTask) {
    removeRecord.current = false;
    setConfirm({
      title: `删除「${task.title}」？`,
      message: '任务和子任务将被永久删除。已击败的 Boss 默认保留在图鉴中。',
      danger: true,
      recordOption: task.rewardClaimed,
      action: async () => {
        await useStore
          .getState()
          .execute({ type: 'delete', id: task.id, removeRecord: removeRecord.current });
      },
    });
  }
  function toggle(task: BossTask, subId: string) {
    const action = async () => {
      await useStore.getState().execute({ type: 'toggle', id: task.id, subId });
    };
    if (task.defeatedAt)
      setConfirm({
        title: '让这位 Boss 重新登场？',
        message: '撤销后会重新计算 HP，图鉴保留首次战绩，再次击败不会重复领取经验。',
        action,
      });
    else void action();
  }
  const selected = data?.tasks.find((t) => t.id === useStore.getState().selectedId);
  const selectedId = useStore((s) => s.selectedId);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        e.ctrlKey &&
        e.key === 'Enter' &&
        !editing &&
        !adding &&
        !confirm &&
        !useStore.getState().victory &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) &&
        page === 'home'
      ) {
        const task = useStore
          .getState()
          .data?.tasks.find((t) => t.id === useStore.getState().selectedId);
        const sub = task?.subTasks.find((s) => !s.completed);
        if (task && sub) {
          e.preventDefault();
          toggle(task, sub.id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, adding, confirm, page, selectedId]);
  if (!ready)
    return (
      <div className="loading">
        <Swords size={32} />
        <p>正在进入 DDL 地牢…</p>
      </div>
    );
  if (!data)
    return (
      <div className="loading">
        <ShieldCheck size={36} />
        <h2>数据需要检查</h2>
        <p>{error}</p>
        <button className="button" onClick={() => location.reload()}>
          重试读取
        </button>
      </div>
    );
  const exp = data.records.reduce((n, r) => n + r.exp, 0);
  return (
    <div className="app-shell">
      <div className="titlebar">
        <span className="titlebar-brand">
          <span className="window-dot red" />
          <span className="window-dot amber" />
          <span className="window-dot green" />
          <span>Deadline Dungeon</span>
        </span>
        <div className="window-controls">
          {window.dungeon ? (
            <>
              <button aria-label="最小化" onClick={() => window.dungeon?.windowAction('minimize')}>
                <Minus size={16} />
              </button>
              <button aria-label="最大化" onClick={() => window.dungeon?.windowAction('maximize')}>
                <Square size={13} />
              </button>
              <button aria-label="关闭到托盘" onClick={() => window.dungeon?.windowAction('close')}>
                <X size={18} />
              </button>
            </>
          ) : (
            <span className="browser-mode">
              <span /> 本地预览
            </span>
          )}
        </div>
      </div>
      {demo && (
        <div className="demo-banner">
          <Play size={14} />
          <strong>演示模式</strong>
          <span>独立沙盒 · 不影响真实任务</span>
          <div>
            <button onClick={() => useStore.getState().setDemoTime(48)}>警戒 48h</button>
            <button onClick={() => useStore.getState().setDemoTime(3)}>狂暴 3h</button>
            <button onClick={() => useStore.getState().setDemoTime(-2)}>逾期 2h</button>
            <button onClick={() => useStore.getState().setDemo(false)}>
              <X size={14} />
              退出演示
            </button>
          </div>
        </div>
      )}
      <div className="workspace">
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              useStore.getState().setPage('home');
            }}
          >
            <div className="brand-icon">
              <Sword size={35} strokeWidth={1.8} />
            </div>
            <div>
              <strong>
                DDL Boss<span className="brand-pixel">战</span>
              </strong>
              <span>把拖延症打成经验值</span>
            </div>
          </a>
          <nav aria-label="主导航">
            {nav.map(({ id, label, Icon }) => (
              <button
                key={id}
                aria-label={label}
                title={label}
                className={page === id ? 'nav-item selected' : 'nav-item'}
                onClick={() => useStore.getState().setPage(id)}
              >
                <Icon size={22} strokeWidth={1.8} />
                <span>{label}</span>
                {id === 'bestiary' && data.records.length > 0 && (
                  <small>{data.records.length}</small>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="cat-speech">
              今天也要
              <br />
              打败 DDL！
              <Sparkles size={14} />
            </div>
            <Sprite type="cat" />
            <div className="player">
              <span className="player-level">Lv.{1 + Math.floor(exp / 200)}</span>
              <div>
                <strong>拖延症挑战者</strong>
                <span>
                  {exp} EXP · 下一级 {200 - (exp % 200)}
                </span>
              </div>
            </div>
          </div>
          <div className="sidebar-version">
            <span className="online-dot" /> 离线冒险中 <span>v1.0</span>
          </div>
        </aside>
        <main className={page === 'home' ? 'home-main' : 'page-main'}>
          {page === 'home' ? (
            <>
              <section className="task-column">
                <div className="task-column-heading">
                  <h1>我的 DDL</h1>
                  <button className="button small" onClick={() => setEditing('new')}>
                    <Plus size={17} />
                    新建任务
                  </button>
                </div>
                <TaskList now={now} onCreate={() => setEditing('new')} />
                <div className="save-status">
                  <span className={`online-dot ${pending ? 'saving' : ''}`} />
                  {pending
                    ? '正在保存…'
                    : demo
                      ? '演示数据 · 退出后自动还原'
                      : '所有更改已保存到本地'}
                  <HardDrive size={13} />
                </div>
              </section>
              {selected ? (
                <>
                  <BattlePanel
                    task={selected}
                    now={now}
                    onEdit={() => edit(selected)}
                    onDelete={() => remove(selected)}
                    onAttack={() => {
                      const s = selected.subTasks.find((s) => !s.completed);
                      if (s) toggle(selected, s.id);
                    }}
                  />
                  <TaskDetails
                    task={selected}
                    now={now}
                    onToggle={(id) => toggle(selected, id)}
                    onAdd={() => {
                      if (selected.rewardClaimed)
                        setConfirm({
                          title: '为已结算任务添加子任务？',
                          message: 'Boss HP 会重新计算，首次结算奖励保持不变。',
                          action: () => setAdding(selected),
                        });
                      else setAdding(selected);
                    }}
                  />
                </>
              ) : (
                <EmptyBattle onCreate={() => setEditing('new')} />
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="page-kicker">DEADLINE DUNGEON</span>
                  <h1>{nav.find((n) => n.id === page)?.label}</h1>
                  <p>
                    {
                      (
                        {
                          tasks: '把每个截止日期，变成一场可以赢的战斗。',
                          bestiary: '每一位倒下的 Boss，都是你认真生活的证据。',
                          achievements: '一点点行动，积累成了不起的自己。',
                          stats: '用真实的行动，记录你的冒险。',
                          settings: '调整你的冒险节奏，一切数据都留在本地。',
                        } as Partial<Record<Page, string>>
                      )[page]
                    }
                  </p>
                </div>
                {page === 'tasks' && (
                  <button className="button" onClick={() => setEditing('new')}>
                    <Plus size={18} />
                    新建任务
                  </button>
                )}
              </div>
              {page === 'tasks' ? (
                <TasksPage
                  now={now}
                  onEdit={edit}
                  onDelete={remove}
                  onCreate={() => setEditing('new')}
                />
              ) : page === 'bestiary' ? (
                <BestiaryPage />
              ) : page === 'settings' ? (
                <SettingsPage onConfirm={setConfirm} />
              ) : page === 'achievements' ? (
                <AchievementsPage />
              ) : (
                <StatsPage now={now} />
              )}
            </>
          )}
        </main>
      </div>
      {editing && (
        <TaskDialog
          task={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && <AddSubDialog task={adding} onClose={() => setAdding(null)} />}
      {confirm && (
        <ConfirmDialog
          value={confirm}
          onClose={() => setConfirm(null)}
          onRecordOption={(value) => {
            removeRecord.current = value;
          }}
        />
      )}
      <VictoryDialog />
      {error && (
        <div className="toast" role="alert">
          <ShieldCheck size={20} />
          <span>{error}</span>
          <button
            aria-label="关闭错误提示"
            className="icon-button"
            onClick={() => useStore.getState().dismissError()}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function TaskList({ now, onCreate }: { now: number; onCreate(): void }) {
  const tasks = useStore((s) => s.data!.tasks);
  const selected = useStore((s) => s.selectedId);
  const [filter, setFilter] = useState<Filter>('all');
  const items = filterTasks(tasks, filter, now);
  return (
    <>
      <div className="task-tabs" role="tablist" aria-label="任务状态">
        {(
          [
            { id: 'all', text: '全部', count: tasks.length },
            {
              id: 'active',
              text: '进行中',
              count: tasks.filter((t) => !t.defeatedAt && t.deadline > now).length,
            },
            { id: 'defeated', text: '已击败', count: tasks.filter((t) => t.defeatedAt).length },
          ] as const
        ).map((t) => (
          <button
            role="tab"
            aria-selected={filter === t.id}
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={filter === t.id ? 'selected' : ''}
          >
            {t.text}
            <span>{t.count}</span>
          </button>
        ))}
      </div>
      <div className="task-list">
        {items.map((task) => (
          <button
            key={task.id}
            className={`task-card ${selected === task.id ? 'selected' : ''} ${task.defeatedAt ? 'completed' : ''}`}
            onClick={() => useStore.getState().select(task.id)}
          >
            <div className={`task-avatar ${task.bossType}`}>
              <Sprite type={task.bossType} />
              {task.defeatedAt && (
                <span className="avatar-check">
                  <Check size={12} />
                </span>
              )}
            </div>
            <div className="task-card-info">
              <strong>{task.title}</strong>
              <Badge task={task} now={now} />
              <span className="task-date">
                {dateText(task.defeatedAt ?? task.deadline)}
                <span>
                  {task.defeatedAt
                    ? '已完成'
                    : task.deadline <= now
                      ? '已逾期'
                      : `${Math.ceil((task.deadline - now) / 86_400_000)} 天后`}
                </span>
              </span>
              <Bar
                value={100 - hp(task) / 10}
                className={
                  status(task, now) === 'urgent' ||
                  status(task, now) === 'rage' ||
                  status(task, now) === 'overdue'
                    ? 'red'
                    : 'green'
                }
              />
              <span className="task-hp">
                {task.defeatedAt ? (
                  <>
                    <CheckCheck size={12} /> BOSS DEFEATED
                  </>
                ) : (
                  <>
                    {hp(task)} <span>/ 1000 HP</span>
                  </>
                )}
              </span>
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <div className="list-empty">
            <Flag size={28} />
            <p>{filter === 'defeated' ? '还没有击败的 Boss' : '这里暂时没有 DDL'}</p>
            <button className="text-button" onClick={onCreate}>
              <Plus size={15} />
              创建第一个任务
            </button>
          </div>
        )}
      </div>
      {tasks.some((t) => t.sample) && (
        <p className="sample-note">当前包含示例任务，可在设置中清除</p>
      )}
    </>
  );
}
function BattlePanel({
  task,
  now,
  onEdit,
  onDelete,
  onAttack,
}: {
  task: BossTask;
  now: number;
  onEdit(): void;
  onDelete(): void;
  onAttack(): void;
}) {
  const [menu, setMenu] = useState(false);
  const battle = useStore((s) => s.battle);
  const pending = useStore((s) => s.pending);
  const [hit, setHit] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setQuoteIndex(0);
    setMenu(false);
  }, [task.id]);
  useEffect(() => {
    if (!battle || battle.taskId !== task.id) return;
    setHit(true);
    setQuoteIndex((n) => n + 1);
    const t = setTimeout(() => setHit(false), 750);
    return () => clearTimeout(t);
  }, [battle, task.id]);
  useEffect(() => {
    const t = setInterval(() => setQuoteIndex((n) => n + 1), 22000);
    return () => clearInterval(t);
  }, [task.id]);
  useEffect(() => {
    if (!menu) return;
    const listener = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [menu]);
  const s = status(task, now);
  const completed = task.subTasks.filter((s) => s.completed).length;
  const remaining = task.subTasks.length - completed;
  const health = hp(task);
  const diff = difficultyInfo[task.difficulty];
  return (
    <section className="battle-panel" aria-label="Boss 战斗">
      <header className="battle-header">
        <div className="battle-title">
          <h2 title={task.title}>{task.title}</h2>
          <Badge task={task} now={now} />
        </div>
        <div ref={menuRef} className="task-menu">
          <button
            className="icon-button bordered"
            aria-label="任务操作"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal size={22} />
          </button>
          {menu && (
            <div className="popover">
              <button
                onClick={() => {
                  onEdit();
                  setMenu(false);
                }}
              >
                <Pencil size={15} />
                编辑任务
              </button>
              <button
                className="danger-text"
                onClick={() => {
                  onDelete();
                  setMenu(false);
                }}
              >
                <Trash2 size={15} />
                删除任务
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="battle-meta">
        <span>
          <CalendarDays size={16} />
          {dateText(task.deadline, true)}
        </span>
        <i />
        <span>
          <ChartNoAxesColumnIncreasing size={16} />
          {diff.label}
          <b>Lv.{diff.level}</b>
        </span>
      </div>
      <div className={`battle-stage ${s} ${hit ? 'is-hit' : ''}`}>
        <div className="stage-heading">
          <span className="boss-number">
            NO. {task.bossType === 'knight' ? '003' : task.bossType === 'slime' ? '001' : '002'}
          </span>
          <span>{bossNames[task.bossType]}</span>
        </div>
        <div className="speech-bubble" key={`${task.id}-${quoteIndex}`}>
          {quote(task, now, quoteIndex)}
        </div>
        <div className="boss-platform" />
        <div className="boss-actor">
          <Sprite type={task.bossType} className={`battle-sprite ${hit ? 'hit' : ''}`} />
        </div>
        {hit && battle && (
          <>
            <span key={battle.key} className="damage-number">
              −{battle.damage}
              <small>HP</small>
            </span>
            <div className="attack-slash" />
          </>
        )}
        {s === 'defeated' && (
          <div className="defeated-stamp">
            <CheckCheck size={18} /> BOSS DEFEATED
          </div>
        )}
        <span className={`stage-status ${s}`}>
          <span />
          {s === 'defeated'
            ? '挑战完成'
            : s === 'rage'
              ? 'Boss 已进入狂暴状态'
              : s === 'overdue'
                ? '继续战斗，永远不晚'
                : s === 'urgent'
                  ? 'Boss 正在警戒'
                  : 'Boss 正在等待你的挑战'}
        </span>
      </div>
      <div className="hp-section">
        <div className="hp-heading">
          <strong>
            <span className="hp-marker" />
            BOSS HP
          </strong>
          <span>
            <b>{health}</b> / 1000
          </span>
        </div>
        <Bar value={health / 10} className={`boss-hp ${s === 'defeated' ? 'green' : 'red'}`} />
        <div className="hp-caption">
          <span>
            {s === 'defeated'
              ? '你赢下了这场战斗'
              : `${completed} 次行动，已造成 ${1000 - health} 点伤害`}
          </span>
          <span>{Math.round(100 - health / 10)}% 完成</span>
        </div>
      </div>
      <div className="battle-bottom">
        <div className="battle-summary">
          <div>
            <div className="summary-icon">
              <Swords size={21} />
            </div>
            <span>
              待完成任务
              <strong>
                {remaining}
                <small> 个</small>
              </strong>
            </span>
          </div>
          <div>
            <div className="summary-icon">
              <Clock3 size={21} />
            </div>
            <span>
              截止倒计时
              <strong className={s === 'rage' || s === 'overdue' ? 'danger-text' : ''}>
                {task.defeatedAt ? '已完成' : timeLeft(task.deadline, now).replace('剩余 ', '')}
              </strong>
            </span>
          </div>
        </div>
        <div className="battle-tip">
          <Sparkles size={15} />
          <span>完成现实任务，就是最强的攻击。</span>
        </div>
        {task.notes && (
          <p className="battle-notes">
            <BookOpen size={14} />
            {task.notes}
          </p>
        )}
        <button className="attack-button" disabled={health === 0 || pending} onClick={onAttack}>
          <CircleCheck size={24} />
          <span>{health === 0 ? 'Boss 已击败，干得漂亮！' : '完成子任务，发起攻击'}</span>
          {health !== 0 && <kbd>Ctrl + Enter</kbd>}
        </button>
        <p className="attack-hint">
          {health === 0
            ? '这场胜利已永久记录在 Boss 图鉴'
            : '点击完成下一项 · 也可以在右侧勾选指定任务'}
        </p>
      </div>
    </section>
  );
}
function TaskDetails({
  task,
  now,
  onToggle,
  onAdd,
}: {
  task: BossTask;
  now: number;
  onToggle(id: string): void;
  onAdd(): void;
}) {
  const activities = useStore((s) => s.data!.activities);
  const pending = useStore((s) => s.pending);
  const [all, setAll] = useState(false);
  const done = task.subTasks.filter((s) => s.completed).length;
  const progress = 100 - hp(task) / 10;
  const history = activities.filter((a) => a.taskId === task.id);
  return (
    <aside className="details-column">
      <section className="panel progress-panel">
        <div className="section-heading">
          <h3>任务进度</h3>
          <span className="mono">
            {done} <span className="muted">/ {task.subTasks.length}</span>
          </span>
        </div>
        <div className="progress-row">
          <Bar value={progress} className={progress === 100 ? 'green' : 'red'} />
          <strong>
            {Math.round(progress)}
            <small>%</small>
          </strong>
        </div>
      </section>
      <section className="panel checklist-panel">
        <div className="section-heading">
          <h3>子任务列表</h3>
          <button
            className="button small"
            disabled={pending || task.subTasks.length >= 100}
            onClick={onAdd}
          >
            <Plus size={15} />
            添加
          </button>
        </div>
        <div className="checklist">
          {task.subTasks.map((sub) => (
            <label key={sub.id} className={`subtask ${sub.completed ? 'done' : ''}`}>
              <input
                type="checkbox"
                checked={sub.completed}
                disabled={pending}
                onChange={() => onToggle(sub.id)}
              />
              <span className="custom-checkbox">
                {sub.completed && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="subtask-title">{sub.title}</span>
              <span className="subtask-damage">
                {Math.round((sub.weight / task.subTasks.reduce((n, s) => n + s.weight, 0)) * 1000)}
              </span>
            </label>
          ))}
        </div>
        <div className="checklist-foot">
          <Sword size={13} />
          <span>每次完成，离胜利更近一步</span>
        </div>
      </section>
      <section className="panel activity-panel">
        <div className="section-heading">
          <h3>最近动态</h3>
          <button className="text-button subtle" onClick={() => setAll(!all)}>
            {all ? '收起' : '查看全部'}
            <ChevronRight size={13} />
          </button>
        </div>
        <div className="activity-list">
          {history.slice(0, all ? 100 : 4).map((a) => (
            <div className="activity" key={a.id}>
              <div className={`activity-icon ${a.type}`}>
                {a.type === 'attack' ? (
                  <Sword size={16} />
                ) : a.type === 'defeat' ? (
                  <Trophy size={16} />
                ) : a.type === 'undo' ? (
                  <RotateCcw size={15} />
                ) : (
                  <ClipboardList size={16} />
                )}
              </div>
              <div>
                <p>{a.title}</p>
                <span className="activity-meta">
                  {relativeText(a.at, now)}
                  {a.damage !== undefined && (
                    <b className={a.damage > 0 ? 'damage' : 'heal'}>
                      {a.damage > 0 ? '−' : '+'}
                      {Math.abs(a.damage)} HP
                    </b>
                  )}
                </span>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p className="muted empty-activity">你的第一步行动，将记录在这里。</p>
          )}
        </div>
      </section>
      <div className="local-note">
        <ShieldCheck size={13} />
        你的任务只保存在这台设备上
      </div>
    </aside>
  );
}
function EmptyBattle({ onCreate }: { onCreate(): void }) {
  return (
    <div className="empty-battle">
      <Sprite type="cat" />
      <h2>地牢很安静。</h2>
      <p>写下你的下一个目标，开始一场新的冒险。</p>
      <button className="button" onClick={onCreate}>
        <Plus size={18} />
        创建 DDL
      </button>
    </div>
  );
}

function TasksPage({
  now,
  onEdit,
  onDelete,
  onCreate,
}: {
  now: number;
  onEdit(task: BossTask): void;
  onDelete(task: BossTask): void;
  onCreate(): void;
}) {
  const tasks = useStore((s) => s.data!.tasks);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('deadline');
  const items = filterTasks(tasks, filter, now, search).sort((a, b) =>
    order === 'created'
      ? b.createdAt - a.createdAt
      : order === 'progress'
        ? hp(a) - hp(b)
        : Number(!!a.defeatedAt) - Number(!!b.defeatedAt) || a.deadline - b.deadline,
  );
  return (
    <>
      <div className="table-toolbar">
        <div className="filter-tabs">
          {(['all', 'active', 'defeated', 'overdue'] as const).map((id) => (
            <button
              key={id}
              className={filter === id ? 'selected' : ''}
              onClick={() => setFilter(id)}
            >
              {{ all: '全部任务', active: '进行中', defeated: '已击败', overdue: '已逾期' }[id]}
              <span>{filterTasks(tasks, id, now).length}</span>
            </button>
          ))}
        </div>
        <div className="table-tools">
          <label className="search-field">
            <Search size={16} />
            <input
              placeholder="搜索任务…"
              aria-label="搜索任务"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select aria-label="任务排序" value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="deadline">按截止时间</option>
            <option value="created">按创建时间</option>
            <option value="progress">按任务进度</option>
          </select>
        </div>
      </div>
      <div className="task-table-wrap">
        <table className="task-table">
          <thead>
            <tr>
              <th>任务 / Boss</th>
              <th>状态</th>
              <th>截止时间</th>
              <th>任务进度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((task) => (
              <tr key={task.id}>
                <td>
                  <button
                    className="table-task"
                    onClick={() => {
                      useStore.getState().select(task.id);
                      useStore.getState().setPage('home');
                    }}
                  >
                    <div className={`table-avatar ${task.bossType}`}>
                      <Sprite type={task.bossType} />
                    </div>
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        {bossNames[task.bossType]} · {difficultyInfo[task.difficulty].label}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <Badge task={task} now={now} />
                </td>
                <td>
                  <span>{dateText(task.deadline, true)}</span>
                  <small className="table-time">
                    {task.defeatedAt ? '已完成挑战' : timeLeft(task.deadline, now)}
                  </small>
                </td>
                <td>
                  <div className="table-progress">
                    <Bar value={100 - hp(task) / 10} className="green" />
                    <span>{Math.round(100 - hp(task) / 10)}%</span>
                  </div>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`编辑${task.title}`}
                      onClick={() => onEdit(task)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button danger-text"
                      aria-label={`删除${task.title}`}
                      onClick={() => onDelete(task)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="page-empty">
            <ClipboardList size={36} />
            <h3>没有找到任务</h3>
            <p>试试其他关键词，或创建一位新的 Boss。</p>
            <button className="button" onClick={onCreate}>
              <Plus size={16} />
              新建任务
            </button>
          </div>
        )}
      </div>
      <p className="page-footnote">
        <HardDrive size={14} />共 {items.length} 个任务 · 数据在本地安全保存
      </p>
    </>
  );
}
function BestiaryPage() {
  const records = useStore((s) => s.data!.records);
  const [filter, setFilter] = useState('all');
  const items = records.filter((r) => filter === 'all' || r.bossType === filter);
  return (
    <>
      <div className="collection-toolbar">
        <div className="filter-tabs">
          {[
            { id: 'all', name: '全部 Boss' },
            ...Object.entries(bossNames).map(([id, name]) => ({ id, name })),
          ].map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? 'selected' : ''}
              onClick={() => setFilter(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <span className="muted">已收录 {records.length} 场胜利</span>
      </div>
      <div className="bestiary-grid">
        {items.map((r) => (
          <article className="collection-card" key={r.id}>
            <div className="collection-art">
              <span className="collection-number">
                NO. {r.bossType === 'knight' ? '003' : r.bossType === 'slime' ? '001' : '002'}
              </span>
              <Sprite type={r.bossType} />
              <span className="collection-seal">
                <Check size={12} />
                {resultLabels[r.result]}
              </span>
            </div>
            <div className="collection-info">
              <span className="muted">
                {bossNames[r.bossType]} · {difficultyInfo[r.difficulty].label}
              </span>
              <h3>{r.title}</h3>
              <div>
                <span>击败于 {dateText(r.defeatedAt, true)}</span>
                <strong>+{r.exp} EXP</strong>
              </div>
              <p className="collection-dates">
                创建 {dateText(r.createdAt)} · 截止 {dateText(r.deadline)}
              </p>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && (
        <div className="page-empty">
          <Skull size={42} />
          <h3>这里还在等待你的战绩</h3>
          <p>完成一个 DDL，就会留下属于你的 Boss 纪念。</p>
          <button className="button" onClick={() => useStore.getState().setPage('home')}>
            回到战斗
            <Swords size={16} />
          </button>
        </div>
      )}
    </>
  );
}
function Toggle({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onChange(value: boolean): void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${value ? 'on' : ''}`}
      onClick={() => onChange(!value)}
    >
      <span />
    </button>
  );
}
function SettingsPage({ onConfirm }: { onConfirm(value: ConfirmState): void }) {
  const settings = useStore((s) => s.data!.settings);
  const pending = useStore((s) => s.pending);
  const demo = useStore((s) => s.demo);
  const tasks = useStore((s) => s.data!.tasks);
  const save = (key: keyof AppSettings, value: boolean | number) =>
    void useStore.getState().execute({ type: 'settings', settings: { [key]: value } });
  return (
    <div className="settings-layout">
      <div>
        <section className="settings-section">
          <h3>
            <Monitor size={18} />
            桌面陪伴
          </h3>
          {[
            {
              key: 'floatingEnabled' as const,
              title: '桌面 Boss 悬浮窗',
              description: '让最近截止的 Boss 安静地陪你工作',
            },
            {
              key: 'alwaysOnTop' as const,
              title: '始终置顶',
              description: '让桌面 Boss 保持在其他窗口上方',
            },
            {
              key: 'closeToTray' as const,
              title: '关闭后驻留托盘',
              description: '关闭主窗口后，Boss 继续陪伴；从托盘菜单退出',
            },
            {
              key: 'launchAtStartup' as const,
              title: '开机自启动',
              description: '安装版支持随 Windows 登录自动开启',
            },
          ].map((item) => (
            <div className="setting-row" key={item.key}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
              <Toggle
                label={item.title}
                value={settings[item.key]}
                onChange={(v) => save(item.key, v)}
                disabled={pending || demo || !window.dungeon}
              />
            </div>
          ))}
          <div className="setting-row">
            <div>
              <strong>Boss 显示大小</strong>
              <p>为你的桌面找到合适的存在感</p>
            </div>
            <div className="scale-control">
              <input
                aria-label="Boss 显示大小"
                type="range"
                min="0.6"
                max="1.6"
                step="0.1"
                disabled={pending || demo || !window.dungeon}
                value={settings.floatingScale}
                onChange={(e) => save('floatingScale', Number(e.target.value))}
              />
              <span>{Math.round(settings.floatingScale * 100)}%</span>
            </div>
          </div>
          {!window.dungeon && (
            <p className="notice">
              <Monitor size={16} />
              桌面陪伴设置在 Electron 桌面版中启用。
            </p>
          )}
        </section>
        <section className="settings-section">
          <h3>
            <Volume2 size={18} />
            战斗反馈
          </h3>
          <div className="setting-row">
            <div>
              <strong>攻击音效</strong>
              <p>完成子任务时，播放简短的像素风提示音</p>
            </div>
            <Toggle
              label="攻击音效"
              value={settings.soundEnabled}
              onChange={(v) => save('soundEnabled', v)}
              disabled={pending}
            />
          </div>
        </section>
        <section className="settings-section">
          <h3>
            <HardDrive size={18} />
            本地数据
          </h3>
          <div className="setting-row">
            <div>
              <strong>导出任务与图鉴</strong>
              <p>将任务、战绩与设置备份为 JSON 文件</p>
            </div>
            <button
              className="button secondary"
              disabled={pending || demo}
              onClick={() => void useStore.getState().exportData()}
            >
              <Download size={16} />
              导出数据
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>导入备份数据</strong>
              <p>替换当前数据，请在导入前保留一份备份</p>
            </div>
            <button
              className="button secondary"
              disabled={pending || demo}
              onClick={() => {
                if (window.dungeon) void useStore.getState().importData();
                else
                  onConfirm({
                    title: '导入并替换当前数据？',
                    message: '请选择之前导出的 DDL Boss JSON 文件。导入会替换当前任务与图鉴。',
                    action: () => useStore.getState().importData(),
                  });
              }}
            >
              <Upload size={16} />
              导入数据
            </button>
          </div>
          {tasks.some((t) => t.sample) && (
            <div className="setting-row">
              <div>
                <strong>清除示例任务</strong>
                <p>移除初次启动的示例，保留你自己创建的任务</p>
              </div>
              <button
                className="button secondary danger-text"
                disabled={pending || demo}
                onClick={() =>
                  onConfirm({
                    title: '清除所有示例数据？',
                    message: '仅删除示例任务及其战绩，你创建的任务会保留。',
                    danger: true,
                    action: async () => {
                      await useStore.getState().execute({ type: 'clearSamples' });
                    },
                  })
                }
              >
                <Trash2 size={16} />
                清除示例
              </button>
            </div>
          )}
        </section>
      </div>
      <aside className="settings-aside">
        <div className="about-card">
          <Sprite type="cat" />
          <h3>
            以前是 DDL 追着我跑，
            <br />
            现在是我追着 DDL 打。
          </h3>
          <p>
            DDL Boss · Deadline Dungeon
            <br />
            v1.0.0 · 本地优先，离线可用
          </p>
          <div>
            <ShieldCheck size={16} />
            无需账号 · 无需联网 · 不上传数据
          </div>
        </div>
        <div className="demo-card">
          <Play size={21} />
          <h3>试一场没有压力的战斗</h3>
          <p>使用独立示例数据，快速体验狂暴、攻击和胜利结算。</p>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => useStore.getState().setDemo(!demo)}
          >
            {demo ? '退出演示模式' : '进入演示模式'}
            <ArrowUpRight size={15} />
          </button>
        </div>
      </aside>
    </div>
  );
}
function AchievementsPage() {
  const data = useStore((s) => s.data!);
  const records = data.records;
  const done = data.tasks.reduce((n, t) => n + t.subTasks.filter((s) => s.completed).length, 0);
  const items = [
    { name: '初出茅庐', desc: '击败你的第一位 Boss', Icon: Sword, value: records.length, goal: 1 },
    { name: '行动派', desc: '完成 10 个子任务', Icon: CheckCheck, value: done, goal: 10 },
    {
      name: '时间的朋友',
      desc: '提前超过 24 小时完成一场挑战',
      Icon: Clock3,
      value: records.filter((r) => r.result === 'early').length,
      goal: 1,
    },
    {
      name: '深渊征服者',
      desc: '击败一位困难 Boss',
      Icon: ShieldCheck,
      value: records.filter((r) => r.difficulty === 'hard').length,
      goal: 1,
    },
    {
      name: '极限反杀',
      desc: '在截止前最后一小时完成任务',
      Icon: Flag,
      value: records.filter((r) => r.result === 'clutch').length,
      goal: 1,
    },
    {
      name: 'DDL 终结者',
      desc: '累计击败 10 位 Boss',
      Icon: Trophy,
      value: records.length,
      goal: 10,
    },
  ];
  return (
    <>
      <div className="achievement-overview">
        <Trophy size={26} />
        <div>
          <h3>
            {items.filter((i) => i.value >= i.goal).length} / {items.length} 项成就已达成
          </h3>
          <p>你的每一步，都算数。</p>
        </div>
      </div>
      <div className="achievements-grid">
        {items.map(({ name, desc, Icon, value, goal }) => (
          <article className={`achievement-card ${value >= goal ? 'unlocked' : ''}`} key={name}>
            <div className="achievement-icon">
              <Icon size={28} />
            </div>
            <div>
              <h3>
                {name}
                {value >= goal && <Check size={15} />}
              </h3>
              <p>{desc}</p>
              <Bar value={Math.min(100, (value / goal) * 100)} className="green" />
              <small>{value >= goal ? '已解锁' : `${value} / ${goal}`}</small>
            </div>
          </article>
        ))}
      </div>
      <p className="page-footnote">成就按当前任务与首次战绩计算；撤销子任务不会重复发放奖励。</p>
    </>
  );
}
function StatsPage({ now }: { now: number }) {
  const data = useStore((s) => s.data!);
  const records = data.records;
  const exp = records.reduce((n, r) => n + r.exp, 0);
  const actions = data.activities.filter((a) => a.type === 'attack');
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 6 + i);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const counts = days.map(
    (start) => actions.filter((a) => a.at >= start && a.at < start + 86_400_000).length,
  );
  const max = Math.max(3, ...counts);
  return (
    <>
      <div className="stat-cards">
        {[
          { label: '击败 Boss', value: records.length, unit: '位', Icon: Skull },
          { label: '累计获得经验', value: exp, unit: 'EXP', Icon: Sparkles },
          {
            label: '完成子任务',
            value: data.tasks.reduce((n, t) => n + t.subTasks.filter((s) => s.completed).length, 0),
            unit: '个',
            Icon: CheckCheck,
          },
          {
            label: '准时完成率',
            value: records.length
              ? Math.round(
                  (records.filter((r) => r.result !== 'overdue').length / records.length) * 100,
                )
              : 0,
            unit: '%',
            Icon: Clock3,
          },
        ].map(({ label, value, unit, Icon }) => (
          <div className="stat-card" key={label}>
            <span>
              <Icon size={18} />
              {label}
            </span>
            <strong>
              {value}
              <small>{unit}</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="stats-layout">
        <section className="panel activity-chart">
          <div className="section-heading">
            <h3>最近 7 天的行动</h3>
            <span className="muted">{counts.reduce((a, b) => a + b, 0)} 次有效攻击</span>
          </div>
          <div className="chart-bars">
            {days.map((d, i) => (
              <div key={d} className={i === 6 ? 'today' : ''}>
                <span className="chart-value">{counts[i]}</span>
                <div className="chart-track">
                  <div
                    style={{ height: `${Math.max(counts[i] ? 4 : 0, (counts[i] / max) * 100)}%` }}
                  />
                </div>
                <span>{i === 6 ? '今天' : dateText(d)}</span>
              </div>
            ))}
          </div>
          <p className="muted">展示保留的最近 500 条动态中的完成次数（含撤销后重新完成）。</p>
        </section>
        <section className="panel adventure-summary">
          <h3>你的冒险手记</h3>
          <div>
            <span>当前等级</span>
            <strong>Lv.{1 + Math.floor(exp / 200)}</strong>
          </div>
          <div>
            <span>待挑战 Boss</span>
            <strong>{data.tasks.filter((t) => !t.defeatedAt).length} 位</strong>
          </div>
          <div>
            <span>已逾期任务</span>
            <strong className="danger-text">
              {data.tasks.filter((t) => !t.defeatedAt && t.deadline <= now).length} 个
            </strong>
          </div>
          <div>
            <span>提前完成</span>
            <strong>{records.filter((r) => r.result === 'early').length} 次</strong>
          </div>
          <p>
            <Sparkles size={16} />
            你的对手一直是昨天的自己。
          </p>
        </section>
      </div>
    </>
  );
}
