import { useMemo } from "react";
import {
  Target,
  Flame,
  CheckCircle2,
  Circle,
  Video,
  NotebookPen,
  CalendarCheck,
  Minus,
  Plus,
  Layers,
} from "lucide-react";
import type {
  Course,
  Lesson,
  LessonStatus,
  Notebook,
  Settings,
} from "../../lib/types";
import { formatBR, formatBRLong, todayISO, daysBetween } from "../../lib/date";
import { cssTint } from "../../lib/colors";
import {
  pendingQueue,
  project,
  projectByCourse,
  currentStreak,
  watchHistory,
  watchedOn,
} from "../../lib/backlog";

const QUEUE_PREVIEW = 8;
const HISTORY_DAYS = 14;

type Props = {
  lessons: Lesson[];
  courses: Course[];
  notebooks: Notebook[];
  settings: Settings;
  onSetGoal: (n: number) => void;
  onSetLessonStatus: (id: string, s: LessonStatus) => void;
  onOpenNotebook: (courseId: string, lessonId: string) => void;
};

export function GoalsPanel({
  lessons,
  courses,
  notebooks,
  settings,
  onSetGoal,
  onSetLessonStatus,
  onOpenNotebook,
}: Props) {
  const today = todayISO();
  const goal = settings.dailyGoal;

  const courseById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses]
  );

  /**
   * "Aula 7" tem que significar a mesma coisa aqui e na aba Disciplinas:
   * posição da aula dentro da disciplina, em ordem de data. Mesmo critério
   * de ordenação usado lá.
   */
  const lessonNumber = useMemo(() => {
    const byCourse = new Map<string, Lesson[]>();
    for (const l of lessons) {
      const arr = byCourse.get(l.courseId);
      if (arr) arr.push(l);
      else byCourse.set(l.courseId, [l]);
    }
    const n = new Map<string, number>();
    for (const arr of byCourse.values()) {
      arr
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach((l, i) => n.set(l.id, i + 1));
    }
    return n;
  }, [lessons]);

  const notebookByLesson = useMemo(
    () =>
      new Map(
        notebooks
          .filter((n) => n.lessonId)
          .map((n) => [n.lessonId as string, n])
      ),
    [notebooks]
  );

  const queue = useMemo(() => pendingQueue(lessons, today), [lessons, today]);
  const proj = useMemo(
    () => project(lessons, today, goal),
    [lessons, today, goal]
  );
  const streak = useMemo(
    () => currentStreak(lessons, today, goal),
    [lessons, today, goal]
  );
  const history = useMemo(
    () => watchHistory(lessons).slice(0, HISTORY_DAYS),
    [lessons]
  );
  const doneToday = useMemo(() => watchedOn(lessons, today), [lessons, today]);
  const byCourse = useMemo(
    () => projectByCourse(lessons, today, goal),
    [lessons, today, goal]
  );
  const heaviest = byCourse.length > 0 ? byCourse[0].pending : 0;

  const pct =
    goal > 0 ? Math.min(100, Math.round((proj.watchedToday / goal) * 100)) : 0;
  const metToday = goal > 0 && proj.watchedToday >= goal;

  return (
    <div className="space-y-4">
      {/* ---- meta + progresso de hoje ---- */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-blue-600" />
          <h2 className="font-semibold text-sm">Meta diária</h2>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSetGoal(Math.max(0, goal - 1))}
              className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Diminuir meta"
            >
              <Minus className="h-3 w-3" />
            </button>
            <input
              type="number"
              min={0}
              max={50}
              value={goal}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) {
                  onSetGoal(Math.max(0, Math.min(50, Math.floor(n))));
                }
              }}
              className="w-12 h-7 text-center rounded-md border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            />
            <button
              type="button"
              onClick={() => onSetGoal(Math.min(50, goal + 1))}
              className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Aumentar meta"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {goal === 0 ? (
          <p className="text-sm text-slate-500">
            Sem meta definida. Aumente para começar a acompanhar o ritmo.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span
                className={
                  metToday
                    ? "text-3xl font-bold text-emerald-600"
                    : "text-3xl font-bold text-slate-900 dark:text-slate-100"
                }
              >
                {proj.watchedToday}
              </span>
              <span className="text-slate-400 text-lg">/ {goal}</span>
              <span className="text-xs text-slate-500 ml-1">
                assistidas hoje
              </span>
              {streak > 0 && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                  <Flame className="h-3.5 w-3.5" />
                  {streak} {streak === 1 ? "dia" : "dias"}
                </span>
              )}
            </div>

            <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={
                  metToday
                    ? "h-full rounded-full transition-all bg-emerald-500"
                    : "h-full rounded-full transition-all bg-blue-500"
                }
                style={{ width: pct + "%" }}
              />
            </div>

            <p className="mt-2 text-xs text-slate-500">
              {metToday
                ? "Meta de hoje batida."
                : "Faltam " + proj.remainingToday + " para bater a meta de hoje."}
            </p>
          </>
        )}
      </section>

      {/* ---- projeção da fila ---- */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarCheck className="h-4 w-4 text-violet-600" />
          <h2 className="font-semibold text-sm">Fila de aulas</h2>
        </div>

        {proj.pending === 0 ? (
          <p className="text-sm text-emerald-600 font-medium">
            Nada pendente. Você está em dia.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="pendentes" value={String(proj.pending)} />
            {proj.finishDate ? (
              <Stat
                label={
                  proj.finishDate === today
                    ? "zera hoje"
                    : "zera em " +
                      proj.daysNeeded +
                      (proj.daysNeeded === 1 ? " dia" : " dias")
                }
                value={formatBR(proj.finishDate)}
              />
            ) : (
              <Stat label="previsão" value="—" />
            )}
          </div>
        )}

        {proj.pending > 0 && proj.finishDate && (
          <p className="mt-2 text-[11px] text-slate-400 leading-snug">
            Supõe a meta cumprida todo dia, inclusive fim de semana, e não
            conta aulas que ainda vão ser gravadas.
          </p>
        )}
      </section>

      {/* ---- dias por disciplina ---- */}
      {byCourse.length > 0 && (
        <section>
          <h2 className="font-semibold text-sm mb-1 flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-500" />
            Dias para ficar em dia
          </h2>
          <p className="text-[11px] text-slate-400 mb-2 leading-snug">
            {goal > 0 ? (
              <>
                No ritmo de {goal} {goal === 1 ? "aula" : "aulas"} por dia.{" "}
                <strong className="font-medium text-slate-500 dark:text-slate-400">
                  Focando
                </strong>{" "}
                = a meta inteira nessa disciplina até zerá-la.{" "}
                <strong className="font-medium text-slate-500 dark:text-slate-400">
                  Na fila
                </strong>{" "}
                = quando ela fecha seguindo a ordem das mais antigas.
              </>
            ) : (
              "Defina uma meta diária acima para ver os prazos."
            )}
          </p>

          <ul className="space-y-1.5">
            {byCourse.map((c) => {
              const course = courseById.get(c.courseId);
              const share =
                heaviest > 0 ? Math.round((c.pending / heaviest) * 100) : 0;
              return (
                <li
                  key={c.courseId}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
                  style={{ borderLeftColor: course?.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-sm font-medium truncate flex-1 min-w-0"
                      style={{ color: course?.color }}
                    >
                      {course?.name ?? "Disciplina removida"}
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {c.pending} {c.pending === 1 ? "aula" : "aulas"}
                    </span>
                  </div>

                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: share + "%",
                        background: course?.color ?? "#64748b",
                      }}
                    />
                  </div>

                  {c.focusDays !== null && (
                    <div className="mt-1.5 flex items-baseline gap-2 text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300">
                        <strong className="font-semibold">
                          {c.focusDays} {c.focusDays === 1 ? "dia" : "dias"}
                        </strong>{" "}
                        <span className="text-slate-400">focando</span>
                        <span className="text-slate-400">
                          {" "}
                          · até {formatBR(c.focusDate as string)}
                        </span>
                      </span>
                      <span className="ml-auto text-slate-400 shrink-0">
                        na fila: {formatBR(c.queueDate as string)}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {goal > 0 && proj.finishDate && proj.daysNeeded !== null && (
            <p className="mt-2 text-xs text-slate-500">
              Tudo que está pendente:{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-200">
                {proj.daysNeeded} {proj.daysNeeded === 1 ? "dia" : "dias"}
              </strong>{" "}
              · zera em {formatBR(proj.finishDate)}.
            </p>
          )}
        </section>
      )}

      {/* ---- por onde ir agora ---- */}
      {queue.length > 0 && (
        <section>
          <h2 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Video className="h-4 w-4 text-slate-500" />
            Por onde ir agora
            <span className="text-xs font-normal text-slate-400">
              (mais antigas primeiro)
            </span>
          </h2>
          <ul className="space-y-1.5">
            {queue.slice(0, QUEUE_PREVIEW).map((lesson) => {
              const course = courseById.get(lesson.courseId);
              const late = daysBetween(lesson.date, today);
              const nb = notebookByLesson.get(lesson.id);
              const hasNotes = !!nb && nb.blocks.length > 0;
              return (
                <li
                  key={lesson.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 flex items-center gap-2.5"
                  style={{ borderLeftColor: course?.color, borderLeftWidth: 3 }}
                >
                  <button
                    type="button"
                    onClick={() => onSetLessonStatus(lesson.id, "assistida")}
                    className="p-0.5 rounded-full text-slate-400 hover:text-emerald-600 shrink-0"
                    title="Marcar como assistida hoje"
                  >
                    <Circle className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: course?.color }}
                    >
                      {course?.name ?? "Disciplina removida"}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        Aula {lessonNumber.get(lesson.id) ?? "?"}
                      </span>
                      <span>{formatBR(lesson.date)}</span>
                      {late > 0 && (
                        <span className="text-amber-600">
                          há {late} {late === 1 ? "dia" : "dias"}
                        </span>
                      )}
                      {lesson.status === "gravada" && (
                        <span className="rounded-full px-1.5 bg-slate-100 dark:bg-slate-800">
                          gravada
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenNotebook(lesson.courseId, lesson.id)}
                    className={
                      hasNotes
                        ? "p-1 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 shrink-0"
                        : "p-1 rounded-md text-slate-400 hover:text-blue-600 shrink-0"
                    }
                    title={
                      hasNotes
                        ? "Abrir as anotações desta aula"
                        : "Abrir o caderno desta aula"
                    }
                  >
                    <NotebookPen className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          {queue.length > QUEUE_PREVIEW && (
            <p className="mt-2 text-xs text-slate-400">
              +{queue.length - QUEUE_PREVIEW} na fila
            </p>
          )}
        </section>
      )}

      {/* ---- histórico por dia ---- */}
      <section>
        <h2 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          O que assisti em cada dia
        </h2>

        {history.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma aula marcada como assistida ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {history.map((day) => {
              const hit = goal > 0 && day.lessons.length >= goal;
              return (
                <li key={day.date}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {day.date === today ? "Hoje" : formatBRLong(day.date)}
                    </span>
                    <span
                      className={
                        hit
                          ? "text-[10px] rounded-full px-1.5 py-0.5 font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : "text-[10px] rounded-full px-1.5 py-0.5 font-medium bg-slate-100 text-slate-500 dark:bg-slate-800"
                      }
                    >
                      {day.lessons.length}
                      {goal > 0 ? "/" + goal : ""}
                    </span>
                  </div>
                  <ul className="space-y-1 pl-1">
                    {day.lessons.map((l) => {
                      const course = courseById.get(l.courseId);
                      return (
                        <li
                          key={l.id}
                          className="text-xs flex items-center gap-2 rounded-md px-2 py-1"
                          style={{
                            background: course
                              ? cssTint(course.color, 0.1)
                              : undefined,
                          }}
                        >
                          <span
                            className="truncate flex-1 min-w-0"
                            style={{ color: course?.color }}
                          >
                            {course?.name ?? "Disciplina removida"}
                          </span>
                          <span className="text-slate-400 shrink-0">
                            Aula {lessonNumber.get(l.id) ?? "?"} ·{" "}
                            {formatBR(l.date)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}

        {doneToday.length === 0 && goal > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            Marque uma aula acima para começar o dia.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-950/50 p-2.5">
      <div className="text-lg font-semibold leading-tight">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
