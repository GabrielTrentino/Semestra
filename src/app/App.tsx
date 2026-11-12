import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Sparkles,
  Maximize2,
  Minimize2,
  Square,
  X,
  Settings as SettingsIcon,
  CalendarClock,
  Target,
} from "lucide-react";
import calendarData from "../data/calendar-2026.json";
import type {
  AcademicCalendar,
  Assignment,
  Course,
  Lesson,
  LessonStatus,
  Notebook,
  Program,
} from "../lib/types";
import { exportBackup, importBackup, useAppState } from "../lib/store";
import { regenerateAllLessons } from "../lib/generateLessons";
import { CoursesPanel } from "../features/courses/CoursesPanel";
import { CalendarPanel } from "../features/calendar/CalendarPanel";
import { TodayPanel } from "../features/today/TodayPanel";
import { GoalsPanel } from "../features/goals/GoalsPanel";
import { SettingsPanel } from "../features/settings/SettingsPanel";
import { todayISO, formatBRLong } from "../lib/date";
import { BubbleView } from "./BubbleView";
import { hasShell, shell, type ShellMode } from "../lib/semestraBridge";
import { currentTerm, extractTerms } from "../lib/terms";

const CAL: AcademicCalendar = calendarData as AcademicCalendar;
const TERMS = extractTerms(CAL);

type Tab = "hoje" | "metas" | "disciplinas" | "calendario";

export default function App() {
  const { state, update, reset, status, pickFolder } = useAppState();
  const [tab, setTab] = useState<Tab>("hoje");
  // Aula cuja anotação deve abrir ao chegar na aba Disciplinas. A aba Metas
  // só aponta; quem abre o caderno é o painel que já sabe renderizá-lo.
  const [focusLesson, setFocusLesson] = useState<{
    courseId: string;
    lessonId: string;
  } | null>(null);
  const [mode, setMode] = useState<ShellMode>("panel");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inShell = hasShell();

  // Hook into Electron mode changes.
  useEffect(() => {
    if (!inShell) return;
    let off: (() => void) | undefined;
    shell.getState().then((s) => {
      if (s) setMode(s.mode);
    });
    off = shell.onMode((m) => setMode(m));
    return () => off?.();
  }, [inShell]);

  // Regenerate lesson occurrences whenever the course list changes.
  useEffect(() => {
    const next = regenerateAllLessons(state.courses, CAL, state.lessons);
    if (
      next.length !== state.lessons.length ||
      next.some(
        (l, i) =>
          state.lessons[i]?.id !== l.id ||
          state.lessons[i]?.status !== l.status
      )
    ) {
      update({ lessons: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courses]);

  const addCourses = (newOnes: Course[]) =>
    update((p) => ({ courses: [...p.courses, ...newOnes] }));

  const updateCourse = (id: string, patch: Partial<Course>) =>
    update((p) => ({
      courses: p.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      lessons:
        patch.link !== undefined
          ? p.lessons.map((l) =>
              l.courseId === id ? { ...l, link: patch.link ?? l.link } : l
            )
          : p.lessons,
    }));

  const deleteCourse = (id: string) =>
    update((p) => ({
      courses: p.courses.filter((c) => c.id !== id),
      lessons: p.lessons.filter((l) => l.courseId !== id),
      notebooks: p.notebooks.filter((n) => n.courseId !== id),
    }));

  // Marcar como assistida carimba o dia em que isso aconteceu; qualquer
  // outro status limpa o carimbo, senão o histórico diário mente.
  const setLessonStatus = (lessonId: string, status: LessonStatus) =>
    update((p) => ({
      lessons: p.lessons.map((l) => {
        if (l.id !== lessonId) return l;
        if (status !== "assistida") {
          const { watchedAt: _drop, ...rest } = l;
          return { ...rest, status };
        }
        return { ...l, status, watchedAt: l.watchedAt ?? todayISO() };
      }),
    }));

  const setDailyGoal = (dailyGoal: number) =>
    update((p) => ({ settings: { ...p.settings, dailyGoal } }));

  const addLesson = (l: Lesson) =>
    update((p) => ({
      lessons: [...p.lessons, l].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    }));

  const addAssignment = (a: Assignment) =>
    update((p) => ({ assignments: [...p.assignments, a] }));

  const updateAssignment = (id: string, patch: Partial<Assignment>) =>
    update((p) => ({
      assignments: p.assignments.map((a) =>
        a.id === id ? { ...a, ...patch } : a
      ),
    }));

  const deleteAssignment = (id: string) =>
    update((p) => ({
      assignments: p.assignments.filter((a) => a.id !== id),
    }));

  const saveProgram = (prog: Program) =>
    update((p) => {
      const exists = p.programs.some((x) => x.id === prog.id);
      return {
        programs: exists
          ? p.programs.map((x) => (x.id === prog.id ? prog : x))
          : [...p.programs, prog],
      };
    });

  const deleteProgram = (id: string) =>
    update((p) => ({
      programs: p.programs.filter((x) => x.id !== id),
      courses: p.courses.map((c) =>
        c.programId === id ? { ...c, programId: undefined } : c
      ),
    }));

  const handleExport = () => {
    const blob = new Blob([exportBackup(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `semestra-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = importBackup(text);
      if (!parsed) {
        alert("Arquivo inválido.");
        return;
      }
      update(parsed);
    };
    input.click();
  };

  // The window is transparent for the bubble's sake; the page background has
  // to follow the mode or the icon sits on an opaque square.
  useEffect(() => {
    document.documentElement.classList.toggle("app-bubble", mode === "bubble");
  }, [mode]);

  // Force a readable window size whenever the renderer is showing the
  // folder-picker or an error state — the bubble is 56px and clips them.
  useEffect(() => {
    if (!inShell) return;
    if (status.phase === "needs-folder" || status.phase === "error") {
      if (mode === "bubble") shell.setMode("panel");
    }
  }, [status.phase, mode, inShell]);

  // ------ FIRST-RUN: ask for data folder ------
  if (status.phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Carregando…
      </div>
    );
  }
  if (status.phase === "needs-folder") {
    return <FolderPrompt onPick={pickFolder} />;
  }
  if (status.phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 p-4 text-sm">
          <div className="font-semibold text-red-700 dark:text-red-400 mb-1">
            Erro ao ler os dados
          </div>
          <div className="text-red-800 dark:text-red-200 mb-3">
            {status.message}
          </div>
          <button
            type="button"
            onClick={pickFolder}
            className="rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 text-xs"
          >
            Escolher outra pasta
          </button>
        </div>
      </div>
    );
  }

  // ------ BUBBLE MODE ------
  if (mode === "bubble") {
    return <BubbleView lessons={state.lessons} courses={state.courses} />;
  }

  const compact = mode === "panel";

  const tabButton = (id: Tab, label: string, Icon: typeof BookOpen) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-2 px-2 py-1.5 text-sm rounded-md ${
        tab === id
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
      title={label}
    >
      <Icon className="h-4 w-4" />
      {!compact && <span>{label}</span>}
    </button>
  );

  const currentTermLabel = currentTerm(TERMS, todayISO())?.label;

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div
          className={`max-w-5xl mx-auto px-3 py-2 flex items-center gap-2 ${
            compact ? "flex-wrap" : ""
          }`}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div
            className="flex items-center gap-2 min-w-0"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="min-w-0 pr-2">
              <div className="font-semibold leading-none">Semestra</div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                {formatBRLong(todayISO())}
              </div>
            </div>
          </div>

          {inShell && (
            <div
              className="flex items-center gap-0.5 ml-1 border-l border-slate-200 dark:border-slate-800 pl-2"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <button
                type="button"
                onClick={() => shell.setMode("bubble")}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Recolher para o ícone flutuante"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  shell.setMode(mode === "full" ? "panel" : "full")
                }
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                title={
                  mode === "full"
                    ? "Voltar ao painel"
                    : "Abrir janela completa"
                }
              >
                {mode === "full" ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => shell.hide()}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600"
                title="Ocultar (Ctrl+Shift+Space)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <nav className="ml-auto flex items-center gap-1">
            {tabButton("hoje", "Hoje", CalendarClock)}
            {tabButton("metas", "Metas", Target)}
            {tabButton("disciplinas", "Disciplinas", BookOpen)}
            {tabButton("calendario", "Calendário", CalendarDays)}
          </nav>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Configurações"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main
        className={`mx-auto px-3 py-4 space-y-5 ${
          compact ? "max-w-full" : "max-w-5xl"
        }`}
      >
        {state.courses.length === 0 && (
          <div
            className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm cursor-pointer"
            onClick={() => setSettingsOpen(true)}
          >
            Nenhuma disciplina cadastrada. Abra <strong>Configurações</strong>{" "}
            (ícone de engrenagem) para importar do WhatsApp ou cadastrar
            instituições.
          </div>
        )}

        {tab === "hoje" && (
          <TodayPanel
            lessons={state.lessons}
            courses={state.courses}
            assignments={state.assignments}
            programs={state.programs}
            onSetLessonStatus={setLessonStatus}
            onAddLesson={addLesson}
            onAddAssignment={addAssignment}
            onUpdateAssignment={updateAssignment}
            onDeleteAssignment={deleteAssignment}
          />
        )}

        {tab === "metas" && (
          <GoalsPanel
            lessons={state.lessons}
            courses={state.courses}
            notebooks={state.notebooks}
            settings={state.settings}
            onSetGoal={setDailyGoal}
            onSetLessonStatus={setLessonStatus}
            onOpenNotebook={(courseId, lessonId) => {
              setFocusLesson({ courseId, lessonId });
              setTab("disciplinas");
            }}
          />
        )}

        {tab === "disciplinas" && (
          <CoursesPanel
            courses={state.courses}
            lessons={state.lessons}
            terms={TERMS}
            programs={state.programs}
            notebooks={state.notebooks}
            focusLesson={focusLesson}
            onFocusHandled={() => setFocusLesson(null)}
            onUpdate={updateCourse}
            onDelete={deleteCourse}
            onSetLessonStatus={setLessonStatus}
            onNotebooksChange={(next: Notebook[]) =>
              update({ notebooks: next })
            }
          />
        )}

        {tab === "calendario" && (
          <CalendarPanel
            calendar={CAL}
            courses={state.courses}
            lessons={state.lessons}
          />
        )}
      </main>

      {settingsOpen && (
        <SettingsPanel
          programs={state.programs}
          courses={state.courses}
          terms={TERMS}
          currentTermLabel={currentTermLabel}
          dataFolder={status.phase === "ready" ? status.folder : null}
          onClose={() => setSettingsOpen(false)}
          onSaveProgram={saveProgram}
          onDeleteProgram={deleteProgram}
          onImportCourses={addCourses}
          onAddCourse={(c) => addCourses([c])}
          onUpdateCourse={updateCourse}
          onDeleteCourse={deleteCourse}
          onExport={handleExport}
          onImportBackup={handleImportBackup}
          onReset={reset}
          onChangeDataFolder={pickFolder}
          onRevealDataFolder={() => shell.data.reveal()}
        />
      )}

      <footer className="max-w-5xl mx-auto px-4 pb-6 text-center text-xs text-slate-500">
        Dados em{" "}
        <button
          type="button"
          onClick={() => shell.data.reveal()}
          className="underline hover:text-slate-700 dark:hover:text-slate-300"
          title="Abrir pasta"
        >
          {status.phase === "ready" && status.folder
            ? status.folder
            : "localStorage"}
        </button>{" "}
        · {CAL.source}
      </footer>
    </div>
  );
}

function FolderPrompt({
  onPick,
}: {
  onPick: () => Promise<{ ok: boolean; error?: string; canceled?: boolean }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    setError(null);
    const r = await onPick();
    setBusy(false);
    if (!r.ok && !r.canceled) setError(r.error ?? "Não foi possível usar essa pasta.");
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-xl text-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <div className="font-semibold">Bem-vindo ao Semestra</div>
        </div>
        <p className="text-slate-600 dark:text-slate-300 mb-4">
          Escolha uma pasta onde o Semestra vai guardar seus dados. A
          estrutura é{" "}
          <code className="text-xs">semestra-data.json</code> (programas,
          disciplinas, aulas, eventos) +{" "}
          <code className="text-xs">notebooks/</code> (um arquivo por
          anotação). Você pode sincronizar com OneDrive, Google Drive, ou
          guardar no pendrive. Nada é escrito em{" "}
          <code className="text-xs">AppData</code> ou{" "}
          <code className="text-xs">Local</code>.
        </p>
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs p-2 mb-3">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handle}
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 font-medium disabled:opacity-50"
        >
          {busy ? "Abrindo seletor…" : "Escolher pasta…"}
        </button>
      </div>
    </div>
  );
}
