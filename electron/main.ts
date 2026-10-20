import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  screen,
  dialog,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { appDataSchema, applyCommand, commandSchema, type AppData } from '../shared/domain';
import { JsonStorage } from './storage';

let main: BrowserWindow | null = null;
let floating: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let storage: JsonStorage;
const devUrl = process.env.VITE_DEV_SERVER_URL;
const preload = path.join(__dirname, 'preload.cjs');
if (!app.isPackaged && process.env.DDL_DATA_DIR)
  app.setPath('userData', path.resolve(process.env.DDL_DATA_DIR));
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
app.on('second-instance', () => showMain());

function trusted(event: IpcMainInvokeEvent | IpcMainEvent, onlyMain = false) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (
    !win ||
    (onlyMain ? win !== main : win !== main && win !== floating) ||
    event.senderFrame !== event.sender.mainFrame
  )
    throw new Error('不允许的窗口请求');
  return win;
}
function secureWindow(win: BrowserWindow) {
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = devUrl
      ? new URL(url).origin === new URL(devUrl).origin
      : url.startsWith('file://') &&
        new URL(url).pathname === new URL(win.webContents.getURL()).pathname;
    if (!allowed) event.preventDefault();
  });
}
async function loadWindow(win: BrowserWindow, float = false) {
  if (devUrl) await win.loadURL(`${devUrl}${float ? '/?floating=1' : ''}`);
  else
    await win.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: float ? { floating: '1' } : {},
    });
}
function createMain() {
  main = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    backgroundColor: '#F5F3EF',
    title: 'DDL Boss · Deadline Dungeon',
    show: false,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  secureWindow(main);
  main.once('ready-to-show', () => main?.show());
  main.on('close', (event) => {
    if (!quitting && storage.snapshot().settings.closeToTray) {
      event.preventDefault();
      main?.hide();
    }
  });
  main.on('closed', () => {
    main = null;
    if (!quitting) app.quit();
  });
  void loadWindow(main);
}
function showMain(taskId?: string) {
  if (!main) createMain();
  if (main?.isMinimized()) main.restore();
  main?.show();
  main?.focus();
  if (taskId) main?.webContents.send('task:select', taskId);
}
function clampPosition(x: number, y: number, width: number, height: number) {
  const area = screen.getDisplayNearestPoint({
    x: Math.round(x + width / 2),
    y: Math.round(y + height / 2),
  }).workArea;
  return {
    x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))),
  };
}
function syncFloating() {
  const data = storage.snapshot();
  if (!data.settings.floatingEnabled) {
    floating?.hide();
    return;
  }
  const width = Math.round(260 * data.settings.floatingScale),
    height = Math.round(310 * data.settings.floatingScale);
  if (!floating) {
    const area = screen.getPrimaryDisplay().workArea;
    const pos = data.floatingPosition ?? {
      x: area.x + area.width - width - 28,
      y: area.y + area.height - height - 20,
    };
    floating = new BrowserWindow({
      ...clampPosition(pos.x, pos.y, width, height),
      width,
      height,
      transparent: true,
      frame: false,
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      show: false,
      alwaysOnTop: data.settings.alwaysOnTop,
      webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    secureWindow(floating);
    floating.setIgnoreMouseEvents(true, { forward: true });
    floating.once('ready-to-show', () => {
      if (storage.snapshot().settings.floatingEnabled) floating?.showInactive();
    });
    floating.on('closed', () => {
      floating = null;
    });
    void loadWindow(floating, true);
  } else {
    floating.setSize(width, height);
    floating.setAlwaysOnTop(data.settings.alwaysOnTop);
    const [x, y] = floating.getPosition();
    const pos = clampPosition(x, y, width, height);
    floating.setPosition(pos.x, pos.y);
    floating.showInactive();
  }
}
function broadcast(data: AppData) {
  for (const win of [main, floating])
    if (win && !win.isDestroyed()) win.webContents.send('data:changed', data);
}
function updateTray() {
  if (!tray) return;
  const settings = storage.snapshot().settings;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开 DDL Boss', click: () => showMain() },
      {
        label: settings.floatingEnabled ? '隐藏桌面 Boss' : '显示桌面 Boss',
        click: () => void updateSettings({ floatingEnabled: !settings.floatingEnabled }),
      },
      { type: 'separator' },
      { label: '退出 DDL Boss', click: () => app.quit() },
    ]),
  );
}
async function updateSettings(settings: Partial<AppData['settings']>) {
  try {
    const data = await storage.transaction((data) =>
      applyCommand(data, { type: 'settings', settings }),
    );
    syncFloating();
    updateTray();
    broadcast(data);
  } catch (error) {
    dialog.showErrorBox('设置保存失败', String(error));
  }
}
function createTray() {
  // Small native monochrome sword icon; character art stays in the renderer.
  const buf = Buffer.alloc(24 * 24 * 4);
  for (let y = 2; y < 22; y++)
    for (let x = 2; x < 22; x++) {
      if (
        (Math.abs(x + y - 23) < 3 && x > 7 && y < 17) ||
        (x >= 4 && x <= 11 && y >= 14 && y <= 17) ||
        (x >= 5 && x <= 8 && y >= 17)
      ) {
        const i = (y * 24 + x) * 4;
        buf[i] = 55;
        buf[i + 1] = 55;
        buf[i + 2] = 55;
        buf[i + 3] = 255;
      }
    }
  tray = new Tray(nativeImage.createFromBitmap(buf, { width: 24, height: 24, scaleFactor: 1 }));
  tray.setToolTip('DDL Boss · 把拖延症打成经验值');
  tray.on('double-click', () => showMain());
  updateTray();
}
function registerIPC() {
  ipcMain.handle('data:read', (event) => {
    trusted(event);
    return storage.snapshot();
  });
  ipcMain.handle('data:command', async (event, raw) => {
    trusted(event, true);
    const cmd = commandSchema.parse(raw);
    if (cmd.type === 'settings' && cmd.settings.launchAtStartup !== undefined && !app.isPackaged)
      throw new Error('开机自启动仅在安装版中可用');
    const data = await storage.transaction((current) => applyCommand(current, cmd));
    if (cmd.type === 'settings') {
      if (app.isPackaged)
        app.setLoginItemSettings({
          openAtLogin: data.settings.launchAtStartup,
          path: process.execPath,
        });
      syncFloating();
      updateTray();
    }
    broadcast(data);
    return data;
  });
  ipcMain.handle('data:export', async (event) => {
    const win = trusted(event, true);
    const result = await dialog.showSaveDialog(win, {
      defaultPath: `DDL-Boss-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 数据', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, JSON.stringify(storage.snapshot(), null, 2), 'utf8');
    return true;
  });
  ipcMain.handle('data:import', async (event) => {
    const win = trusted(event, true);
    const choice = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['取消', '选择文件并替换'],
      defaultId: 0,
      cancelId: 0,
      message: '导入将替换当前任务和图鉴',
      detail: '当前数据会自动保留为最近一次备份。建议先导出一份数据。',
    });
    if (choice.response !== 1) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'DDL Boss 数据', extensions: ['json'] }],
    });
    if (result.canceled) return null;
    if ((await fs.stat(result.filePaths[0])).size > 10_000_000)
      throw new Error('数据文件不能超过 10 MB');
    const parsed = appDataSchema.safeParse(
      JSON.parse(await fs.readFile(result.filePaths[0], 'utf8')),
    );
    if (!parsed.success) throw new Error('导入失败：文件格式或任务数据不正确');
    const data = await storage.transaction(() => parsed.data);
    if (app.isPackaged)
      app.setLoginItemSettings({
        openAtLogin: data.settings.launchAtStartup,
        path: process.execPath,
      });
    syncFloating();
    updateTray();
    broadcast(data);
    return data;
  });
  ipcMain.on('window:action', (event, action: string, taskId?: string) => {
    const win = trusted(event);
    if (action === 'show') {
      showMain(typeof taskId === 'string' ? taskId : undefined);
      return;
    }
    if (win !== main) return;
    if (action === 'minimize') main?.minimize();
    if (action === 'maximize') main?.isMaximized() ? main.unmaximize() : main?.maximize();
    if (action === 'close') main?.close();
    if (action === 'quit') app.quit();
  });
  ipcMain.on('floating:interactive', (event, interactive: boolean) => {
    if (trusted(event) === floating && typeof interactive === 'boolean')
      floating?.setIgnoreMouseEvents(!interactive, { forward: true });
  });
  let drag: { x: number; y: number; wx: number; wy: number } | null = null;
  ipcMain.on('floating:drag', (event, action: string, x: number, y: number) => {
    if (trusted(event) !== floating || !floating || !Number.isFinite(x) || !Number.isFinite(y))
      return;
    if (action === 'start') {
      const [wx, wy] = floating.getPosition();
      drag = { x, y, wx, wy };
    }
    if (action === 'move' && drag) {
      const [w, h] = floating.getSize();
      const pos = clampPosition(drag.wx + x - drag.x, drag.wy + y - drag.y, w, h);
      floating.setPosition(pos.x, pos.y);
    }
    if (action === 'end' && drag) {
      drag = null;
      const [px, py] = floating.getPosition();
      void storage
        .transaction((data) => ({ ...data, floatingPosition: { x: px, y: py } }))
        .catch((error) => dialog.showErrorBox('位置保存失败', String(error)));
    }
  });
  ipcMain.on('floating:menu', (event) => {
    if (trusted(event) !== floating || !floating) return;
    Menu.buildFromTemplate([
      { label: '打开 DDL Boss', click: () => showMain() },
      {
        label: '置顶显示',
        type: 'checkbox',
        checked: storage.snapshot().settings.alwaysOnTop,
        click: (item) => void updateSettings({ alwaysOnTop: item.checked }),
      },
      { label: '隐藏桌面 Boss', click: () => void updateSettings({ floatingEnabled: false }) },
      { type: 'separator' },
      { label: '退出应用', click: () => app.quit() },
    ]).popup({ window: floating });
  });
}
app.on('before-quit', () => {
  quitting = true;
});
app.on('will-quit', () => {
  tray?.destroy();
});
app.on('window-all-closed', () => {
  if (quitting) app.quit();
});
app.on('activate', () => showMain());
if (locked)
  void app.whenReady().then(async () => {
    app.setAppUserModelId('com.deadlinedungeon.desktop');
    storage = new JsonStorage(app.getPath('userData'));
    try {
      await storage.load();
    } catch (error) {
      dialog.showErrorBox(
        '无法读取 DDL Boss 数据',
        `原始文件已保留：${storage.file}\n${String(error)}`,
      );
      app.quit();
      return;
    }
    registerIPC();
    createMain();
    createTray();
    syncFloating();
    const reposition = () => {
      if (floating) {
        const [x, y] = floating.getPosition(),
          [w, h] = floating.getSize();
        const p = clampPosition(x, y, w, h);
        floating.setPosition(p.x, p.y);
      }
    };
    screen.on('display-metrics-changed', reposition);
    screen.on('display-removed', reposition);
  });
