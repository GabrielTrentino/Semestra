import { useEffect, useState, useCallback } from "react";
import type {
  Assignment,
  Course,
  Lesson,
  Notebook,
  Program,
} from "./types";

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

/**
 * Migra formatos antigos: `course.termLabel` (string) → `course.termLabels`
 * (string[]). Também garante `programs[].calendarId` para registros antigos.
 */
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

function load(): AppState {
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return migrate(JSON.parse(raw));
  } catch {
    return EMPTY;
  }
}

function save(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — ignore */
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(() => load());

  useEffect(() => {
    save(state);
  }, [state]);

  const update = useCallback(
    (patch: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) => {
      setState((prev) => {
        const p = typeof patch === "function" ? patch(prev) : patch;
        return { ...prev, ...p };
      });
    },
    []
  );

  const reset = useCallback(() => {
    setState(EMPTY);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { state, setState, update, reset };
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
