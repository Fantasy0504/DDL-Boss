import { promises as fs } from 'node:fs';
import path from 'node:path';
import { appDataSchema, seedData, type AppData } from '../shared/domain';

export class JsonStorage {
  private data!: AppData;
  private queue: Promise<unknown> = Promise.resolve();
  readonly file: string;
  constructor(directory: string) {
    this.file = path.join(directory, 'dungeon.json');
  }
  async load() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.data = appDataSchema.parse(JSON.parse(await fs.readFile(this.file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        try {
          this.data = appDataSchema.parse(
            JSON.parse(await fs.readFile(`${this.file}.bak`, 'utf8')),
          );
        } catch (backupError) {
          if ((backupError as NodeJS.ErrnoException).code !== 'ENOENT')
            throw new Error('备份数据损坏，请保留数据文件并联系开发者');
          this.data = seedData();
        }
        await this.write(this.data, false);
      } else {
        const backup = appDataSchema.parse(
          JSON.parse(await fs.readFile(`${this.file}.bak`, 'utf8')),
        );
        await fs.copyFile(this.file, `${this.file}.corrupt-${Date.now()}`);
        this.data = backup;
        await this.write(backup, false);
      }
    }
    return this.snapshot();
  }
  snapshot() {
    return structuredClone(this.data);
  }
  transaction(fn: (data: AppData) => AppData) {
    const result = this.queue.then(async () => {
      const next = appDataSchema.parse(fn(this.snapshot()));
      await this.write(next, true);
      this.data = next;
      return this.snapshot();
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async write(data: AppData, backup: boolean) {
    const tmp = `${this.file}.tmp`;
    const handle = await fs.open(tmp, 'w');
    try {
      await handle.writeFile(JSON.stringify(data, null, 2), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (backup) await fs.copyFile(this.file, `${this.file}.bak`);
    await fs.rename(tmp, this.file);
  }
}
