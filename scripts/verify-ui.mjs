import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const output = process.env.DDL_QA_OUTPUT ?? path.join(os.tmpdir(), 'ddl-boss-qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1536, height: 1024 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const url = process.env.DDL_URL ?? 'http://127.0.0.1:5173';
const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('deadline-dungeon-v1')));
const check = (name, fn) => fn().then(() => console.log(`PASS ${name}`));
const health = async (value) => {
  await page.locator('.hp-heading').getByText(String(value), { exact: true }).waitFor();
};
try {
  await page.goto(url);
  await page.getByRole('heading', { name: '我的 DDL' }).waitFor();
  assert.equal(await page.title(), 'DDL Boss · Deadline Dungeon');
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  await page.screenshot({ path: path.join(output, 'desktop-1536.png') });
  await check('attack, animation and undo recalculate HP', async () => {
    await page.getByRole('checkbox', { name: /实现核心代码模块/ }).check();
    await health(400);
    await page.getByRole('checkbox', { name: /实现核心代码模块/ }).uncheck();
    await health(600);
    const task = (await data()).tasks[0];
    assert.equal(task.subTasks[2].completed, false);
  });
  await check('complete creation, custom weights and editing', async () => {
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '完整创建', exact: true }).click();
    await dialog.getByRole('textbox', { name: /任务名称/ }).fill('QA 加权课程设计');
    await page.waitForTimeout(1200); // Cross a clock tick while editing the form.
    assert.equal(
      await dialog
        .getByRole('textbox', { name: /任务名称/ })
        .evaluate((e) => e === document.activeElement),
      true,
      'clock updates preserve form focus',
    );
    await dialog.getByLabel('任务难度').selectOption('hard');
    await dialog.getByLabel('子任务 1', { exact: true }).fill('资料收集');
    await dialog.getByLabel('权重 1', { exact: true }).fill('20');
    await dialog.getByRole('button', { name: '添加子任务', exact: true }).click();
    await dialog.getByLabel('子任务 2', { exact: true }).fill('实现模块');
    await dialog.getByLabel('权重 2', { exact: true }).fill('40');
    await dialog.getByRole('button', { name: '添加子任务', exact: true }).click();
    await dialog.getByLabel('子任务 3', { exact: true }).fill('测试交付');
    await dialog.getByLabel('权重 3', { exact: true }).fill('40');
    await dialog.getByRole('button', { name: '召唤 Boss', exact: true }).click();
    await page.locator('.battle-title h2').getByText('QA 加权课程设计', { exact: true }).waitFor();
    await health(1000);
    await page.getByRole('button', { name: '任务操作' }).click();
    await page.getByRole('button', { name: '编辑任务', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('textbox', { name: /备注/ })
      .fill('编辑验证：保留任务权重');
    await page.getByRole('button', { name: '保存修改' }).click();
    await page.getByText('编辑验证：保留任务权重').waitFor();
  });
  await check('weighted damage, victory and exactly one reward', async () => {
    await page.getByRole('checkbox', { name: /资料收集/ }).check();
    await health(800);
    await page.getByRole('checkbox', { name: /实现模块/ }).check();
    await health(400);
    await page.getByRole('checkbox', { name: /测试交付/ }).check();
    await page.getByRole('dialog', { name: '挑战完成' }).waitFor();
    assert.match(await page.getByRole('dialog').innerText(), /180/);
    await page.getByRole('button', { name: '关闭弹窗' }).click();
    await health(0);
    let snapshot = await data();
    assert.equal(snapshot.records.length, 2);
    await page.getByRole('checkbox', { name: /测试交付/ }).click();
    await page.getByRole('button', { name: '确认继续' }).click();
    await health(400);
    await page.getByRole('checkbox', { name: /测试交付/ }).check();
    await health(0);
    snapshot = await data();
    assert.equal(snapshot.records.length, 2);
    assert.equal(await page.getByRole('dialog').count(), 0);
  });
  await check('task table, filters, deletion and retained history', async () => {
    await page.getByRole('button', { name: '任务列表', exact: true }).click();
    await page.getByRole('textbox', { name: '搜索任务' }).fill('QA 加权');
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('button', { name: '删除QA 加权课程设计' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await page.getByRole('heading', { name: '没有找到任务' }).waitFor();
    assert.equal((await data()).records.length, 2);
    await page.getByRole('button', { name: /Boss 图鉴/ }).click();
    assert.equal(await page.locator('.collection-card').count(), 2);
  });
  await check('quick creation and restart persistence', async () => {
    await page.getByRole('button', { name: '首页', exact: true }).click();
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('textbox', { name: /任务名称/ })
      .fill('QA 快速任务');
    await page.getByRole('button', { name: '召唤 Boss', exact: true }).click();
    await health(1000);
    await page.reload();
    await page.getByRole('heading', { name: '我的 DDL' }).waitFor();
    assert((await data()).tasks.some((t) => t.title === 'QA 快速任务'));
  });
  await check('demo rage state and isolation', async () => {
    const before = JSON.stringify(await data());
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: /进入演示模式/ }).click();
    await page.getByRole('button', { name: '狂暴 3h', exact: true }).click();
    await page.getByText('Boss 已进入狂暴状态').waitFor();
    await page.getByRole('checkbox', { name: /实现核心代码模块/ }).check();
    await health(400);
    assert.equal(JSON.stringify(await data()), before);
    await page.getByRole('button', { name: '退出演示', exact: true }).click();
    assert.equal(JSON.stringify(await data()), before);
  });
  await check('settings, export and invalid import safety', async () => {
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('switch', { name: '攻击音效' }).click();
    assert.equal((await data()).settings.soundEnabled, true);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出数据' }).click();
    assert.match((await download).suggestedFilename(), /DDL-Boss/);
    const before = JSON.stringify(await data());
    await page.getByRole('button', { name: '导入数据' }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '确认继续' }).click();
    await (
      await chooser
    ).setFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":2}'),
    });
    await page.getByRole('alert').waitFor();
    assert.equal(JSON.stringify(await data()), before);
    await page.getByRole('button', { name: '关闭错误提示' }).click();
  });
  for (const nav of ['成就', '数据统计']) {
    await page.getByRole('button', { name: nav, exact: true }).click();
    await page.getByRole('heading', { name: nav, exact: true }).waitFor();
  }
  assert.deepEqual(errors, []);
  await check('native desktop, minimum desktop and mobile layout', async () => {
    for (const [width, height] of [
      [1536, 1024],
      [1440, 940],
      [1100, 680],
      [390, 844],
    ]) {
      const clean = await browser.newContext({
        viewport: { width, height },
        reducedMotion: 'reduce',
      });
      const p = await clean.newPage();
      await p.goto(url);
      await p.getByRole('heading', { name: '我的 DDL' }).waitFor();
      await p.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `horizontal page overflow at ${width}`);
      if (width >= 1001) {
        const attack = await p.locator('.attack-button').boundingBox();
        assert(
          attack.y + attack.height <= height,
          `primary attack button visible at ${width}x${height}`,
        );
      }
      assert.equal(await p.locator('vite-error-overlay').count(), 0);
      await p.getByRole('button', { name: '设置', exact: true }).click();
      await p.getByRole('heading', { name: '设置', exact: true }).waitFor();
      assert.equal(
        await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `settings overflow at ${width}`,
      );
      await p.screenshot({ path: path.join(output, `settings-${width}.png`), fullPage: true });
      await clean.close();
    }
  });
  console.log(`UI verification complete. Screenshots: ${output}`);
} finally {
  await browser.close();
}
