declare module 'electron' {
  export const app: {
    isPackaged: boolean;
    getName(): string;
    getVersion(): string;
    whenReady(): Promise<void>;
    on(event: 'activate' | 'window-all-closed', listener: (...args: any[]) => void): void;
    quit(): void;
    setAppUserModelId(id: string): void;
    setPath(name: 'userData', value: string): void;
    getPath(name: 'userData' | 'downloads'): string;
  };

  export class BrowserWindow {
    constructor(options?: {
      width?: number;
      height?: number;
      minWidth?: number;
      minHeight?: number;
      title?: string;
      frame?: boolean;
      titleBarStyle?: 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover';
      autoHideMenuBar?: boolean;
      backgroundColor?: string;
      icon?: string;
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
    setMenu(menu: unknown): void;
    minimize(): void;
    maximize(): void;
    unmaximize(): void;
    isMaximized(): boolean;
    close(): void;
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
    static fromWebContents(webContents: unknown): BrowserWindow | null;
  }

  export const Menu: {
    setApplicationMenu(menu: unknown): void;
  };

  export const protocol: {
    registerSchemesAsPrivileged(schemes: Array<{
      scheme: string;
      privileges: {
        secure?: boolean;
        standard?: boolean;
        supportFetchAPI?: boolean;
        stream?: boolean;
      };
    }>): void;
    handle(
      scheme: string,
      handler: (request: Request) => Promise<Response> | Response
    ): void;
  };

  export const net: {
    fetch(input: string, init?: RequestInit): Promise<Response>;
  };

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
    showSaveDialog(
      browserWindow: BrowserWindow | null,
      options: {
        title?: string;
        defaultPath?: string;
        buttonLabel?: string;
      }
    ): Promise<{
      canceled: boolean;
      filePath?: string;
    }>;
    showSaveDialog(options: {
      title?: string;
      defaultPath?: string;
      buttonLabel?: string;
    }): Promise<{
      canceled: boolean;
      filePath?: string;
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

  export const webUtils: {
    getPathForFile(file: unknown): string;
  };
}
