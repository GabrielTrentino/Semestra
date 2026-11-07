import { useEffect, useMemo, useRef } from "react";
import type { Course, Lesson } from "../lib/types";
import { shell } from "../lib/semestraBridge";
import { todayISO } from "../lib/date";
import logoUrl from "../assets/logo.png";

type Props = {
  lessons: Lesson[];
  courses: Course[];
};

/** Movement under this many pixels counts as a click, not a drag. */
const CLICK_SLOP = 4;

export function BubbleView({ lessons, courses }: Props) {
  const today = todayISO();

  const pendingToday = useMemo(
    () => lessons.filter((l) => l.date === today && l.status === "prevista").length,
    [lessons, today]
  );

  const nextUp = useMemo(
    () => lessons.find((l) => l.date >= today && l.status !== "assistida"),
    [lessons, today]
  );
  const nextCourse = nextUp
    ? courses.find((c) => c.id === nextUp.courseId)
    : undefined;

  const origin = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  // Backstop: pointer capture normally keeps the release coming to us, but if
  // focus is lost mid-drag the element never sees pointerup and the bubble
  // would stay stuck to the cursor. Listen wider.
  useEffect(() => {
    const release = () => {
      if (!origin.current) return;
      origin.current = null;
      void shell.bubbleDragEnd();
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("blur", release);
    };
  }, []);

  // The window follows the OS cursor from the main process; here we only
  // decide whether the gesture ended up being a click or a drag.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    origin.current = { x: e.screenX, y: e.screenY };
    moved.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    void shell.bubbleDragStart();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!origin.current) return;
    const dx = e.screenX - origin.current.x;
    const dy = e.screenY - origin.current.y;
    if (Math.hypot(dx, dy) > CLICK_SLOP) moved.current = true;
  };

  const endGesture = (e: React.PointerEvent) => {
    if (!origin.current) return;
    origin.current = null;
    void shell.bubbleDragEnd();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (!moved.current) void shell.setMode("panel");
  };

  const title = nextUp
    ? `Semestra — próxima: ${nextCourse?.name ?? "aula"} (${
        nextUp.date === today ? "hoje" : nextUp.date.slice(5)
      })`
    : "Semestra — abrir painel";

  return (
    <div className="h-screen w-screen bg-transparent overflow-hidden select-none">
      <button
        type="button"
        title={title}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        className="relative h-14 w-14 rounded-full overflow-hidden cursor-grab active:cursor-grabbing
                   shadow-lg shadow-slate-950/40 ring-1 ring-white/10
                   transition-transform duration-100 hover:scale-105 active:scale-95"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <img
          src={logoUrl}
          alt="Semestra"
          draggable={false}
          className="h-full w-full object-cover pointer-events-none"
        />
        {pendingToday > 0 && (
          <span
            className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full
                       bg-amber-500 text-slate-950 text-[10px] font-bold
                       flex items-center justify-center ring-2 ring-slate-950"
          >
            {pendingToday}
          </span>
        )}
      </button>
    </div>
  );
}
