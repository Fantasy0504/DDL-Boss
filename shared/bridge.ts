import type { AppData, Command } from './domain';
export interface DesktopBridge {
  read(): Promise<AppData>;
  command(command: Command): Promise<AppData>;
  subscribe(callback: (data: AppData) => void): () => void;
  onSelect(callback: (id: string) => void): () => void;
  exportData(): Promise<boolean>;
  importData(): Promise<AppData | null>;
  windowAction(action: 'minimize' | 'maximize' | 'close' | 'show' | 'quit', taskId?: string): void;
  floatingMenu(): void;
  mouseInteractive(interactive: boolean): void;
  drag(action: 'start' | 'move' | 'end', x: number, y: number): void;
}
declare global {
  interface Window {
    dungeon?: DesktopBridge;
  }
}
