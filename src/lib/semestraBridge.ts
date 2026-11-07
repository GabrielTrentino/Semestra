// Thin bridge to the Electron shell (optional — the app still works in plain
// browser; semestra will be undefined and buttons become no-ops).

export type ShellMode = "bubble" | "panel" | "full";

type ShellState = {
  mode: ShellMode;
  platform: string;
};

export type RunLanguage = "csharp" | "java" | "python";

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
  python: string | null;
};

export type DataLocation = {
  folder: string | null;
  exists: boolean;
  hasData: boolean;
};

export type DataPickResult =
  | { ok: true; folder: string; hasData: boolean }
  | { ok: false; canceled?: boolean; error?: string };

export type DataReadResult =
  | { ok: true; state: unknown | null; folder: string }
  | { ok: false; reason: string; message?: string; folder?: string };

export type DataWriteResult =
  | { ok: true }
  | { ok: false; reason: string; message?: string };

export type SaveImagePayload = { mime: string; data: Uint8Array };

export type SaveImageResult =
  | { ok: true; name: string; bytes: number }
  | { ok: false; error: string };

type SemestraAPI = {
  setMode: (mode: ShellMode) => Promise<void>;
  bubbleDragStart: () => Promise<void>;
  bubbleDragEnd: () => Promise<void>;
  hide: () => Promise<void>;
  getState: () => Promise<ShellState>;
  openExternal: (url: string) => Promise<void>;
  runCode: (payload: { language: RunLanguage; source: string }) => Promise<RunResult>;
  checkRuntimes: () => Promise<RuntimeStatus>;
  onMode: (cb: (mode: ShellMode) => void) => () => void;
  data: {
    getLocation: () => Promise<DataLocation>;
    pickFolder: () => Promise<DataPickResult>;
    read: () => Promise<DataReadResult>;
    write: (state: unknown) => Promise<DataWriteResult>;
    reveal: () => Promise<void>;
    saveImage: (payload: SaveImagePayload) => Promise<SaveImageResult>;
  };
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
  bubbleDragStart() {
    return window.semestra?.bubbleDragStart();
  },
  bubbleDragEnd() {
    return window.semestra?.bubbleDragEnd();
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
  data: {
    async getLocation(): Promise<DataLocation | null> {
      return (await window.semestra?.data.getLocation()) ?? null;
    },
    async pickFolder(): Promise<DataPickResult> {
      return (
        (await window.semestra?.data.pickFolder()) ?? {
          ok: false,
          error: "Shell não disponível",
        }
      );
    },
    async read(): Promise<DataReadResult> {
      return (
        (await window.semestra?.data.read()) ?? {
          ok: false,
          reason: "no-shell",
        }
      );
    },
    async write(state: unknown): Promise<DataWriteResult> {
      return (
        (await window.semestra?.data.write(state)) ?? {
          ok: false,
          reason: "no-shell",
        }
      );
    },
    async reveal() {
      await window.semestra?.data.reveal();
    },
    async saveImage(payload: SaveImagePayload): Promise<SaveImageResult> {
      return (
        (await window.semestra?.data.saveImage(payload)) ?? {
          ok: false,
          error: "Shell não disponível",
        }
      );
    },
  },
};

/** Markdown `![](assets/x.png)` -> a URL the renderer can actually load. */
export function assetUrl(src: string): string {
  const name = src.replace(/^\.?\/*/, "").replace(/^assets\//, "");
  return `semestra-asset://img/${encodeURIComponent(name)}`;
}
