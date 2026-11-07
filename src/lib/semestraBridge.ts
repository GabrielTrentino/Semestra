// Thin bridge to the Electron shell (optional — the app still works in plain
// browser; semestra will be undefined and buttons become no-ops).

export type ShellMode = "dock" | "panel" | "full";
export type ShellSide = "left" | "right";

type ShellState = {
  mode: ShellMode;
  side: ShellSide;
  platform: string;
};

export type RunLanguage = "csharp" | "java";

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  elapsedMs: number;
  error?: string;
};

export type RuntimeStatus = {
  dotnet: string | null;
  dotnetScript: string | null;
  javac: string | null;
};

type SemestraAPI = {
  setMode: (mode: ShellMode) => Promise<void>;
  toggleSide: () => Promise<ShellSide>;
  hide: () => Promise<void>;
  getState: () => Promise<ShellState>;
  openExternal: (url: string) => Promise<void>;
  runCode: (payload: { language: RunLanguage; source: string }) => Promise<RunResult>;
  checkRuntimes: () => Promise<RuntimeStatus>;
  onMode: (cb: (mode: ShellMode) => void) => () => void;
};

declare global {
  interface Window {
    semestra?: SemestraAPI;
  }
}

export function hasShell(): boolean {
  return typeof window !== "undefined" && !!window.semestra;
}

export const shell = {
  setMode(mode: ShellMode) {
    return window.semestra?.setMode(mode);
  },
  toggleSide() {
    return window.semestra?.toggleSide();
  },
  hide() {
    return window.semestra?.hide();
  },
  async getState(): Promise<ShellState | null> {
    return (await window.semestra?.getState()) ?? null;
  },
  openExternal(url: string) {
    return window.semestra?.openExternal(url);
  },
  async runCode(language: RunLanguage, source: string): Promise<RunResult> {
    if (!window.semestra) {
      return {
        stdout: "",
        stderr: "",
        exitCode: null,
        elapsedMs: 0,
        error:
          "Execução de código só funciona dentro do Semestra Desktop (precisa do processo Electron).",
      };
    }
    return window.semestra.runCode({ language, source });
  },
  async checkRuntimes(): Promise<RuntimeStatus | null> {
    return (await window.semestra?.checkRuntimes()) ?? null;
  },
  onMode(cb: (mode: ShellMode) => void): () => void {
    return window.semestra?.onMode(cb) ?? (() => undefined);
  },
};
