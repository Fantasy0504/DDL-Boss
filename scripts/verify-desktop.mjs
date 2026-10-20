import { _electron as electron } from 'playwright';
import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const directory = await mkdtemp(path.join(os.tmpdir(), 'ddl-desktop-test-'));
const output = process.env.DDL_QA_OUTPUT ?? path.join(os.tmpdir(), 'ddl-boss-qa');
await mkdir(output, { recursive: true });
const env = { ...process.env, DDL_DATA_DIR: directory };
delete env.ELECTRON_RUN_AS_NODE;
delete env.VITE_DEV_SERVER_URL;
const errors = [];
const packaged = process.argv.includes('--packaged');
async function launch() {
  const app = await electron.launch({
    ...(packaged ? { executablePath: path.resolve('release/win-unpacked/DDL Boss.exe') } : {}),
    args: packaged ? [`--user-data-dir=${directory}`] : ['.'],
    cwd: process.cwd(),
    env,
  });
  app.on('window', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  try {
    await app.firstWindow();
    while (app.windows().length < 2) await app.waitForEvent('window');
    await Promise.all(app.windows().map((p) => p.waitForURL(/index\.html/)));
    const main = app.windows().find((p) => !p.url().includes('floating=1'));
    await main.getByRole('heading', { name: '我的 DDL' }).waitFor();
    console.log(packaged ? 'Packaged executable' : 'Development executable');
    return { app, main };
  } catch (error) {
    await app.close();
    throw error;
  }
}
let instance;
try {
  instance = await launch();
  const { app, main } = instance;
  while (app.windows().length < 2) await app.waitForEvent('window');
  const floating = app.windows().find((p) => p !== main);
  await floating.locator('.float-pet').waitFor();
  assert.equal(await main.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await main.evaluate(() => typeof window.dungeon.command), 'function');
  await main.getByRole('checkbox', { name: /实现核心代码模块/ }).click();
  await main.locator('.hp-heading').getByText('400', { exact: true }).waitFor();
  await floating
    .locator('.float-tooltip b')
    .getByText('400 / 1000', { exact: true })
    .waitFor({ state: 'attached' });
  const windows = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => ({
      transparent: w.isVisible(),
      top: w.isAlwaysOnTop(),
      bounds: w.getBounds(),
    })),
  );
  assert.equal(windows.length, 2);
  console.log('PASS isolated preload, real JSON storage and main/floating IPC sync');
  await main.screenshot({ path: path.join(output, 'electron-main.png') });
  await main.getByRole('button', { name: '设置', exact: true }).click();
  await main.getByRole('switch', { name: '始终置顶' }).click();
  await main.locator('[role="switch"][aria-label="始终置顶"][aria-checked="false"]').waitFor();
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('floating=1'))
        ?.isAlwaysOnTop(),
    ),
    false,
  );
  await main.getByRole('switch', { name: '桌面 Boss 悬浮窗' }).click();
  await main
    .locator('[role="switch"][aria-label="桌面 Boss 悬浮窗"][aria-checked="false"]')
    .waitFor();
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('floating=1'))
        ?.isVisible(),
    ),
    false,
  );
  await main.getByRole('switch', { name: '桌面 Boss 悬浮窗' }).click();
  await main
    .locator('[role="switch"][aria-label="桌面 Boss 悬浮窗"][aria-checked="true"]')
    .waitFor();
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('floating=1'))
        ?.isVisible(),
    ),
    true,
  );
  const range = main.getByRole('slider', { name: 'Boss 显示大小' });
  await range.focus();
  await range.press('ArrowRight');
  await main.getByText('110%', { exact: true }).waitFor();
  const scaledWidth = await app.evaluate(
    ({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('floating=1'))
        ?.getSize()[0],
  );
  assert(Math.abs(scaledWidth - 286) <= 3, 'scaled window respects Windows DPI rounding');
  console.log('PASS floating hide/restore, always-on-top and sizing');
  const exportFile = path.join(directory, 'export.json');
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, exportFile);
  await main.getByRole('button', { name: '导出数据' }).click();
  await main.waitForFunction(async () => !(await window.dungeon.read()).settings.soundEnabled);
  let exported;
  for (let i = 0; i < 30; i++) {
    try {
      exported = JSON.parse(await readFile(exportFile, 'utf8'));
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  assert(exported, 'export file written by main process');
  await main.getByRole('switch', { name: '攻击音效' }).click();
  await main.locator('[role="switch"][aria-label="攻击音效"][aria-checked="true"]').waitFor();
  await app.evaluate(({ dialog }, file) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, exportFile);
  await main.getByRole('button', { name: '导入数据' }).click();
  await main.locator('[role="switch"][aria-label="攻击音效"][aria-checked="false"]').waitFor();
  const invalidFile = path.join(directory, 'invalid.json');
  await writeFile(invalidFile, '{"version":2}');
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, invalidFile);
  await main.getByRole('button', { name: '导入数据' }).click();
  await main.getByRole('alert').waitFor();
  assert.equal(
    JSON.parse(await readFile(path.join(directory, 'dungeon.json'), 'utf8')).tasks[0].subTasks[2]
      .completed,
    true,
  );
  await main.getByRole('button', { name: '关闭错误提示' }).click();
  console.log('PASS desktop JSON export/import roundtrip and invalid import preservation');
  await main.getByRole('button', { name: '关闭到托盘' }).click();
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => !w.webContents.getURL().includes('floating=1'))
        ?.isVisible(),
    ),
    false,
  );
  await floating.evaluate(() => window.dungeon.windowAction('show'));
  await main.getByRole('heading', { name: '设置', exact: true }).waitFor();
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => !w.webContents.getURL().includes('floating=1'))
        ?.isVisible(),
    ),
    true,
  );
  console.log('PASS close-to-tray residency and floating restore');
  const before = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().includes('floating=1'))
      ?.getPosition(),
  );
  const bounds = await floating.locator('.float-pet').boundingBox();
  const px = bounds.x + bounds.width * 0.5,
    py = bounds.y + bounds.height * 0.55;
  await floating.mouse.move(px, py);
  await floating.mouse.down();
  await floating.mouse.move(px - 60, py - 40, { steps: 5 });
  await floating.mouse.up();
  const after = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().includes('floating=1'))
      ?.getPosition(),
  );
  assert.notDeepEqual(after, before);
  console.log('PASS floating drag changes screen position');
  const persisted = JSON.parse(await readFile(path.join(directory, 'dungeon.json'), 'utf8'));
  assert.equal(persisted.tasks[0].subTasks[2].completed, true);
  assert.equal(persisted.settings.alwaysOnTop, false);
  await app.close();
  instance = null;
  instance = await launch();
  await instance.main.locator('.hp-heading').getByText('400', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS desktop restart retains tasks and settings; no renderer errors');
} finally {
  if (instance) await instance.app.close();
  await rm(directory, { recursive: true, force: true });
}
