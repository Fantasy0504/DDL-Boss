import { create } from 'zustand';
import {
  appDataSchema,
  applyCommand,
  hp,
  seedData,
  type AppData,
  type BattleRecord,
  type Command,
} from '../shared/domain';

const STORAGE_KEY = 'deadline-dungeon-v1';
export type Page = 'home' | 'tasks' | 'bestiary' | 'achievements' | 'stats' | 'settings';
interface Store {
  data: AppData | null;
  ready: boolean;
  pending: boolean;
  selectedId: string | null;
  page: Page;
  demo: boolean;
  realData: AppData | null;
  error: string | null;
  battle: { key: number; damage: number; taskId: string } | null;
  victory: BattleRecord | null;
  select(id: string): void;
  setPage(page: Page): void;
  dismissError(): void;
  dismissVictory(): void;
  execute(cmd: Command): Promise<AppData | null>;
  setDemo(enabled: boolean): void;
  setDemoTime(hours: number): void;
  importData(): Promise<void>;
  exportData(): Promise<void>;
}
function choose(data: AppData, current: string | null) {
  return data.tasks.some((t) => t.id === current)
    ? current
    : ([...data.tasks].sort(
        (a, b) => Number(!!a.defeatedAt) - Number(!!b.defeatedAt) || a.deadline - b.deadline,
      )[0]?.id ?? null);
}
function commit(data: AppData) {
  const state = useStore.getState();
  const old = state.data?.tasks.find((t) => t.id === state.selectedId);
  const next = data.tasks.find((t) => t.id === state.selectedId);
  const damage = old && next ? hp(old) - hp(next) : 0;
  const record = data.records.find(
    (r) =>
      !state.data?.records.some((previous) => previous.id === r.id) &&
      r.taskId === state.selectedId,
  );
  useStore.setState({
    data,
    selectedId: choose(data, state.selectedId),
    ...(damage > 0 && next ? { battle: { key: Date.now(), damage, taskId: next.id } } : {}),
    ...(record ? { victory: record } : {}),
  });
  if (
    damage > 0 &&
    data.settings.soundEnabled &&
    !new URLSearchParams(location.search).has('floating')
  )
    playHit();
}
export const useStore = create<Store>((set, get) => ({
  data: null,
  ready: false,
  pending: false,
  selectedId: null,
  page: 'home',
  demo: false,
  realData: null,
  error: null,
  battle: null,
  victory: null,
  select: (id) => set({ selectedId: id }),
  setPage: (page) => set({ page }),
  dismissError: () => set({ error: null }),
  dismissVictory: () => set({ victory: null }),
  async execute(cmd) {
    if (get().pending || !get().data) return null;
    set({ pending: true });
    try {
      const previous = get().data!;
      const data =
        get().demo || !window.dungeon
          ? applyCommand(previous, cmd)
          : await window.dungeon.command(cmd);
      if (!get().demo && !window.dungeon) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      commit(data);
      if (cmd.type === 'create')
        set({
          selectedId:
            data.tasks.find((t) => !previous.tasks.some((p) => p.id === t.id))?.id ??
            get().selectedId,
          page: 'home',
        });
      return data;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '保存失败，请重试' });
      return null;
    } finally {
      set({ pending: false });
    }
  },
  setDemo(enabled) {
    if (enabled === get().demo || get().pending) return;
    if (enabled) {
      const data = seedData();
      set({
        realData: get().data,
        data,
        demo: true,
        selectedId: data.tasks[0].id,
        page: 'home',
        victory: null,
      });
    } else {
      const data = get().realData!;
      set({ data, demo: false, realData: null, selectedId: choose(data, null), victory: null });
    }
  },
  setDemoTime(hours) {
    const { demo, data, selectedId } = get();
    if (!demo || !data) return;
    set({
      data: {
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === selectedId ? { ...t, deadline: Date.now() + hours * 3_600_000 } : t,
        ),
      },
    });
  },
  async importData() {
    if (get().demo || get().pending) return;
    set({ pending: true });
    try {
      if (window.dungeon) {
        const data = await window.dungeon.importData();
        if (data) commit(data);
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
          try {
            const file = input.files?.[0];
            if (!file) return;
            if (file.size > 10_000_000) throw new Error('文件不能超过 10 MB');
            const data = appDataSchema.parse(JSON.parse(await file.text()));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            commit(data);
          } catch {
            set({ error: '导入失败：不是有效的 DDL Boss 数据文件' });
          }
        };
        input.click();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导入失败' });
    } finally {
      set({ pending: false });
    }
  },
  async exportData() {
    try {
      if (get().demo) throw new Error('请先退出演示模式，再导出真实任务');
      if (window.dungeon) await window.dungeon.exportData();
      else {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(get().data, null, 2)], { type: 'application/json' }),
        );
        const a = document.createElement('a');
        a.href = url;
        a.download = `DDL-Boss-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导出失败' });
    }
  },
}));
let initPromise: Promise<void> | undefined;
export function initialize() {
  return (initPromise ??= (async () => {
    try {
      let data: AppData;
      if (window.dungeon) {
        window.dungeon.subscribe((data) => {
          if (useStore.getState().demo) useStore.setState({ realData: data });
          else commit(data);
        });
        window.dungeon.onSelect((id) => useStore.setState({ selectedId: id, page: 'home' }));
        data = await window.dungeon.read();
      } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) data = appDataSchema.parse(JSON.parse(raw));
        else {
          data = seedData();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        window.addEventListener('storage', (e) => {
          if (e.key === STORAGE_KEY && e.newValue) {
            const parsed = appDataSchema.safeParse(JSON.parse(e.newValue));
            if (parsed.success && !useStore.getState().demo) commit(parsed.data);
          }
        });
      }
      useStore.setState({ data, ready: true, selectedId: choose(data, null) });
    } catch {
      useStore.setState({
        ready: true,
        error: '无法读取本地数据。请保留原始文件并重启应用；没有覆盖现有数据。',
      });
    }
  })());
}
let audio: AudioContext | undefined;
function playHit() {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audio.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.16);
  } catch {
    /* Audio is optional. */
  }
}
