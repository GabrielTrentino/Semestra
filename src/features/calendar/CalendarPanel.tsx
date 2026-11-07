import { useMemo } from "react";
import type {
  AcademicCalendar,
  Course,
  Lesson,
} from "../../lib/types";
import { WEEKDAY_SHORT } from "../../lib/types";
import { formatBR, todayISO } from "../../lib/date";
import { cssTint } from "../../lib/colors";

type DayKey = "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB";

type Props = {
  calendar: AcademicCalendar;
  courses: Course[];
  lessons: Lesson[];
};

const DAY_KEYS: DayKey[] = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

export function CalendarPanel({ calendar, courses, lessons }: Props) {
  const today = todayISO();
  const courseById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses]
  );

  const lessonsByDate = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const l of lessons) {
      const arr = map.get(l.date);
      if (arr) arr.push(l);
      else map.set(l.date, [l]);
    }
    return map;
  }, [lessons]);

  const holidayByDate = useMemo(
    () => new Map(calendar.holidays.map((h) => [h.date, h.description])),
    [calendar.holidays]
  );

  const currentWeekIdx = useMemo(() => {
    const i = calendar.weeks.findIndex((w) =>
      Object.values(w.dates).some((d) => d === today)
    );
    return i >= 0 ? i : null;
  }, [calendar.weeks, today]);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Calendário acadêmico</h2>
          <p className="text-sm text-slate-500">{calendar.source}</p>
        </div>
        {currentWeekIdx !== null && (
          <div className="text-sm text-slate-500">
            Semana atual:{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {calendar.weeks[currentWeekIdx].label}
              {calendar.weeks[currentWeekIdx].week
                ? ` · ${calendar.weeks[currentWeekIdx].week}`
                : ""}
            </strong>
          </div>
        )}
      </header>

      <div className="overflow-x-auto -mx-3 px-3 pb-2">
        <table className="text-sm border-collapse min-w-[760px] w-max">
          <thead>
            <tr>
              <th className="text-left font-medium text-xs text-slate-500 pb-2 pr-3">
                Período
              </th>
              {DAY_KEYS.map((d) => (
                <th
                  key={d}
                  className="text-left font-medium text-xs text-slate-500 pb-2 px-2"
                >
                  {WEEKDAY_SHORT[d]}
                </th>
              ))}
              <th className="text-left font-medium text-xs text-slate-500 pb-2 pl-2">
                Observações
              </th>
            </tr>
          </thead>
          <tbody>
            {calendar.weeks.map((w, i) => {
              const nonAulas = w.kind !== "aulas";
              return (
                <tr
                  key={i}
                  className={`border-t border-slate-200 dark:border-slate-800 ${
                    i === currentWeekIdx
                      ? "bg-amber-50 dark:bg-amber-950/30"
                      : nonAulas
                      ? "bg-slate-50 dark:bg-slate-900/40"
                      : ""
                  }`}
                >
                  <td className="py-2 pr-3 align-top">
                    <div className="font-medium">{w.label}</div>
                    {w.week && (
                      <div className="text-xs text-slate-500">{w.week}</div>
                    )}
                  </td>
                  {DAY_KEYS.map((d) => {
                    const iso = w.dates[d];
                    if (!iso)
                      return (
                        <td key={d} className="py-2 px-2 align-top">
                          <div className="text-slate-300">—</div>
                        </td>
                      );
                    const dayLessons = lessonsByDate.get(iso) ?? [];
                    const holiday = holidayByDate.get(iso);
                    const isToday = iso === today;
                    return (
                      <td
                        key={d}
                        className={`py-2 px-2 align-top ${
                          isToday ? "ring-2 ring-amber-400 rounded-md" : ""
                        }`}
                      >
                        <div
                          className={`text-xs ${
                            isToday
                              ? "font-semibold"
                              : "text-slate-500"
                          }`}
                        >
                          {iso.slice(-2)}
                        </div>
                        {holiday && (
                          <div className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-400 line-clamp-2">
                            {holiday}
                          </div>
                        )}
                        {dayLessons.map((l) => {
                          const c = courseById.get(l.courseId);
                          if (!c) return null;
                          return (
                            <div
                              key={l.id}
                              className="mt-1 rounded px-1 py-0.5 text-[10px] truncate"
                              title={c.name}
                              style={{
                                background: cssTint(c.color, 0.18),
                                color: c.color,
                                textDecoration:
                                  l.status === "assistida"
                                    ? "line-through"
                                    : undefined,
                                opacity:
                                  l.status === "faltei" ? 0.5 : undefined,
                              }}
                            >
                              {c.name}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                  <td className="py-2 pl-2 align-top text-xs text-slate-500 whitespace-pre-line max-w-xs">
                    {w.observacoes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="text-xs text-slate-500">
        <div className="font-medium text-slate-700 dark:text-slate-300 mb-1">
          Feriados detectados
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {calendar.holidays.map((h, i) => (
            <li key={i}>
              <span className="font-mono">{formatBR(h.date)}</span> —{" "}
              {h.description}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
