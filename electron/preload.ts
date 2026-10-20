import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '../shared/bridge';
const bridge: DesktopBridge = {
  read: () => ipcRenderer.invoke('data:read'),
  command: (command) => ipcRenderer.invoke('data:command', command),
  subscribe: (callback) => {
    const handler = (_: unknown, data: Parameters<typeof callback>[0]) => callback(data);
    ipcRenderer.on('data:changed', handler);
    return () => ipcRenderer.removeListener('data:changed', handler);
  },
  onSelect: (callback) => {
    const handler = (_: unknown, id: string) => callback(id);
    ipcRenderer.on('task:select', handler);
    return () => ipcRenderer.removeListener('task:select', handler);
  },
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  windowAction: (action, taskId) => ipcRenderer.send('window:action', action, taskId),
  floatingMenu: () => ipcRenderer.send('floating:menu'),
  mouseInteractive: (interactive) => ipcRenderer.send('floating:interactive', interactive),
  drag: (action, x, y) => ipcRenderer.send('floating:drag', action, x, y),
};
contextBridge.exposeInMainWorld('dungeon', bridge);
