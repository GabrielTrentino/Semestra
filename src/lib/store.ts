import { useEffect, useRef, useState, useCallback } from "react";
import type {
  Assignment,
  Course,
  Lesson,
  Notebook,
  Program,
} from "./types";
import { hasShell, shell } from "./semestraBridge";

const STORAGE_KEY = "semestra:state:v1";

export type AppState = {
  programs: Program[];
  courses: Course[];
  lessons: Lesson[];
  assignments: Assignment[];
  notebooks: Notebook[];
};

const EMPTY: AppState = {
  programs: [
    {
      id: "p-engsoft",
      name: "Eng. de Software",
      institution: "INFNET",
      color: "#2563eb",
      calendarId: "infnet-2026",
    },
  ],
  courses: [],
  lessons: [],
  assignments: [],
  notebooks: [],
};

function migrate(raw: Partial<AppState> & { courses?: unknown[] }): AppState {
  const programs: Program[] = (raw.programs ?? EMPTY.programs).map((p) => ({
    ...p,
    calendarId:
      p.calendarId === undefined && p.institution?.toUpperCase().includes("INFNET")
        ? "infnet-2026"
        : p.calendarId ?? null,
  }));

  const courses: Course[] = ((raw.courses ?? []) as any[]).map((c) => {
    const { termLabel, termLabels, ...rest } = c;
    const labels: string[] = Array.isArray(termLabels)
      ? termLabels
      : termLabel
      ? [termLabel]
      : [];
    return {
      ...rest,
      termLabels: labels.length > 0 ? labels : undefined,
    } as Course;
  });

  return {
    programs,
    courses,
    lessons: (raw.lessons as Lesson[]) ?? [],
    assignments: (raw.assignments as Assignment[]) ?? [],
    notebooks: (raw.notebooks as Notebook[]) ?? [],
  };
}

function loadLocalFallback(): AppState {
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return migrate(JSON.parse(raw));
  } catch {
    return EMPTY;
  }
}

function saveLocalFallback(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export type StoreStatus =
  | { phase: "loading" }
  | { phase: "needs-folder" }
  | { phase: "error"; message: string }
  | { phase: "ready"; folder: string | null };

export function useAppState() {
  const [state, setState] = useState<AppState>(EMPTY);
  const [status, setStatus] = useState<StoreStatus>(() =>
    hasShell() ? { phase: "loading" } : { phase: "ready", folder: null }
  );
  const dirtyRef = useRef(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    if (!hasShell()) {
      setState(loadLocalFallback());
      return;
    }
    (async () => {
      const loc = await shell.data.getLocation();
      if (cancelled) return;
      if (!loc?.folder || !loc.exists) {
        setStatus({ phase: "needs-folder" });
        return;
      }
      const res = await shell.data.read();
      if (cancelled) return;
      if (!res.ok) {
        setStatus({
          phase: "error",
          message: res.message ?? res.reason,
        });
        return;
      }
      if (res.state) {
        setState(migrate(res.state as any));
      } else {
        // Folder exists but no data file yet — migrate from localStorage once.
        const legacy = loadLocalFallback();
        setState(legacy);
        if (legacy !== EMPTY) {
          await shell.data.write(legacy);
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* ignore */
          }
        }
      }
      setStatus({ phase: "ready", folder: res.folder });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change (debounced), only once we're ready.
  useEffect(() => {
    if (status.phase !== "ready") return;
    if (!dirtyRef.current) return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      if (hasShell()) {
        shell.data.write(state);
      } else {
        saveLocalFallback(state);
      }
    }, 150);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [state, status]);

  const update = useCallback(
    (patch: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) => {
      dirtyRef.current = true;
      setState((prev) => {
        const p = typeof patch === "function" ? patch(prev) : patch;
        return { ...prev, ...p };
      });
    },
    []
  );

  const reset = useCallback(() => {
    dirtyRef.current = true;
    setState(EMPTY);
  }, []);

  const pickFolder = useCallback(async () => {
    const wasReady = status.phase === "ready";
    const res = await shell.data.pickFolder();
    if (!res.ok) return res;

    if (res.hasData) {
      // Folder already has a semestra-data.json — adopt it.
      const read = await shell.data.read();
      if (read.ok && read.state) setState(migrate(read.state as any));
    } else if (wasReady) {
      // Changing folder: move current in-memory state into the new folder.
      await shell.data.write(state);
    } else {
      // First-run and the picked folder is empty: seed from localStorage if any.
      const legacy = loadLocalFallback();
      setState(legacy);
      if (JSON.stringify(legacy) !== JSON.stringify(EMPTY)) {
        await shell.data.write(legacy);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    }
    setStatus({ phase: "ready", folder: res.folder });
    return res;
  }, [state, status]);

  return { state, setState, update, reset, status, pickFolder };
}

export function exportBackup(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importBackup(json: string): AppState | null {
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== "object") return null;
    return migrate(data);
  } catch {
    return null;
  }
}
