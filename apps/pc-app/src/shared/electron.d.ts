declare module 'electron' {
  export const app: {
    isPackaged: boolean;
    getName(): string;
    getVersion(): string;
    whenReady(): Promise<void>;
    on(event: 'activate' | 'window-all-closed', listener: (...args: any[]) => void): void;
    quit(): void;
    setPath(name: 'userData', value: string): void;
    getPath(name: 'userData'): string;
  };

  export class BrowserWindow {
    constructor(options?: {
      width?: number;
      height?: number;
      minWidth?: number;
      minHeight?: number;
      title?: string;
      backgroundColor?: string;
      webPreferences?: {
        preload?: string;
        contextIsolation?: boolean;
        nodeIntegration?: boolean;
        sandbox?: boolean;
        webSecurity?: boolean;
        allowRunningInsecureContent?: boolean;
      };
    });

    loadURL(url: string): Promise<void>;
    loadFile(path: string): Promise<void>;
    webContents: {
      setWindowOpenHandler(
        handler: (details: { url: string }) => { action: 'deny' | 'allow' }
      ): void;
      openDevTools(options?: { mode?: 'detach' | 'undocked' | 'right' | 'bottom' }): void;
      on(
        event: 'will-navigate',
        listener: (event: { preventDefault(): void }, url: string) => void
      ): void;
    };

    static getAllWindows(): BrowserWindow[];
  }

  export const shell: {
    openExternal(url: string): Promise<void>;
    openPath(path: string): Promise<string>;
  };

  export const dialog: {
    showOpenDialog(options: {
      title?: string;
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
    }): Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;
  };

  export const ipcMain: {
    handle(channel: string, listener: (...args: any[]) => any): void;
  };

  export const contextBridge: {
    exposeInMainWorld(key: string, api: unknown): void;
  };

  export const ipcRenderer: {
    invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
  };
}
