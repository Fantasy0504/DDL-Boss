import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { JsonStorage } from '../electron/storage';
import { applyCommand } from '../shared/domain';
const dirs: string[] = [];
async function storage() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddl-storage-test-'));
  dirs.push(dir);
  const store = new JsonStorage(dir);
  await store.load();
  return store;
}
afterEach(async () => {
  for (const dir of dirs.splice(0)) await fs.rm(dir, { recursive: true, force: true });
});
describe('local atomic storage', () => {
  it('persists task changes and reloads them', async () => {
    const store = await storage();
    await store.transaction((d) =>
      applyCommand(d, { type: 'toggle', id: d.tasks[0].id, subId: d.tasks[0].subTasks[2].id }),
    );
    const reload = new JsonStorage(path.dirname(store.file));
    await reload.load();
    expect(reload.snapshot().tasks[0].subTasks[2].completed).toBe(true);
    expect(
      JSON.parse(await fs.readFile(`${store.file}.bak`, 'utf8')).tasks[0].subTasks[2].completed,
    ).toBe(false);
  });
  it('serializes simultaneous window updates', async () => {
    const store = await storage();
    await Promise.all([
      store.transaction((d) =>
        applyCommand(d, { type: 'settings', settings: { soundEnabled: true } }),
      ),
      store.transaction((d) =>
        applyCommand(d, { type: 'settings', settings: { alwaysOnTop: false } }),
      ),
    ]);
    expect(store.snapshot().settings).toMatchObject({ soundEnabled: true, alwaysOnTop: false });
  });
  it('restores a valid backup and preserves the corrupt original', async () => {
    const store = await storage();
    await store.transaction((d) =>
      applyCommand(d, { type: 'settings', settings: { soundEnabled: true } }),
    );
    await fs.writeFile(store.file, 'broken-json');
    const reload = new JsonStorage(path.dirname(store.file));
    await reload.load();
    expect(reload.snapshot().settings.soundEnabled).toBe(false);
    const corrupt = (await fs.readdir(path.dirname(store.file))).find((p) =>
      p.includes('.corrupt-'),
    );
    expect(corrupt).toBeTruthy();
    expect(await fs.readFile(path.join(path.dirname(store.file), corrupt!), 'utf8')).toBe(
      'broken-json',
    );
  });
  it('does not overwrite state when a transaction fails validation', async () => {
    const store = await storage();
    const before = await fs.readFile(store.file, 'utf8');
    await expect(
      store.transaction((d) => ({ ...d, version: 2 }) as unknown as typeof d),
    ).rejects.toThrow();
    expect(await fs.readFile(store.file, 'utf8')).toBe(before);
    await store.transaction((d) =>
      applyCommand(d, { type: 'settings', settings: { soundEnabled: true } }),
    );
    expect(store.snapshot().settings.soundEnabled).toBe(true);
  });
});
