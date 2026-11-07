import { useMemo } from "react";
import {
  BookOpen,
  CalendarDays,
  ClipboardPaste,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Video,
} from "lucide-react";
import type { Course, Lesson } from "../lib/types";
import { shell } from "../lib/semestraBridge";
import { todayISO } from "../lib/date";

type Props = {
  lessons: Lesson[];
  courses: Course[];
  side: "left" | "right";
};

export function DockView({ lessons, courses, side }: Props) {
  const today = todayISO();
  const todays = useMemo(
    () => lessons.filter((l) => l.date === today),
    [lessons, today]
  );
  const nextUp = useMemo(
    () => lessons.find((l) => l.date >= today && l.status !== "assistida"),
    [lessons, today]
  );
  const courseById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses]
  );
  const nextCourse = nextUp ? courseById.get(nextUp.courseId) : null;

  const pendingToday = todays.filter((l) => l.status === "prevista").length;

  return (
    <div
      className="h-screen w-full flex flex-col items-center bg-slate-900 text-slate-100"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={() => shell.setMode("panel")}
        className="mt-2 h-12 w-12 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
        title="Expandir painel"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {side === "right" ? (
          <ChevronLeft className="h-5 w-5" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </button>

      <div className="my-3 h-px w-10 bg-slate-700" />

      <DockIcon
        label="Aulas de hoje"
        onClick={() => shell.setMode("panel")}
        badge={pendingToday > 0 ? pendingToday : undefined}
      >
        <BookOpen className="h-5 w-5" />
      </DockIcon>

      <DockIcon label="Importar" onClick={() => shell.setMode("panel")}>
        <ClipboardPaste className="h-5 w-5" />
      </DockIcon>

      <DockIcon label="Calendário" onClick={() => shell.setMode("panel")}>
        <CalendarDays className="h-5 w-5" />
      </DockIcon>

      <div className="my-3 h-px w-10 bg-slate-700" />

      {nextUp && nextCourse && (
        <div
          className="w-14 rounded-md p-1 text-[9px] text-center font-medium leading-tight"
          style={{ background: nextCourse.color, color: "white" }}
          title={`${nextCourse.name} — ${nextUp.date}`}
        >
          <div className="truncate">{nextCourse.name.split(" ")[0]}</div>
          <div className="opacity-80">
            {nextUp.date === today ? "hoje" : nextUp.date.slice(5)}
          </div>
        </div>
      )}

      <div className="mt-auto mb-3 flex flex-col items-center gap-2">
        {nextUp?.link && (
          <button
            type="button"
            onClick={() => shell.openExternal(nextUp.link!)}
            className="h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center"
            title={`Entrar na próxima aula (${nextCourse?.name})`}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <Video className="h-4 w-4" />
          </button>
        )}
        {pendingToday === 0 && todays.length > 0 && (
          <div
            className="h-8 w-8 rounded-full bg-emerald-700/40 flex items-center justify-center"
            title="Todas as aulas de hoje marcadas"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
        )}
      </div>
    </div>
  );
}

function DockIcon({
  children,
  label,
  onClick,
  badge,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="relative mt-2 h-11 w-11 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {children}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}
