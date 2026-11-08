import type { Lesson } from "./types";
import { formatISODate, parseISODate } from "./date";

/**
 * A aula conta como "pendente de assistir" se:
 *   - está marcada como gravada (o caso explícito), ou
 *   - está prevista e a data já passou (ficou para trás sem ser marcada).
 *
 * Aulas previstas no futuro não entram: ainda não existem para assistir.
 */
export function isPending(lesson: Lesson, today: string): boolean {
  if (lesson.status === "gravada") return true;
  return lesson.status === "prevista" && lesson.date < today;
}

/** Fila de pendentes, mais antiga primeiro — a ordem em que faz sentido ir. */
export function pendingQueue(lessons: Lesson[], today: string): Lesson[] {
  return lessons
    .filter((l) => isPending(l, today))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function watchedOn(lessons: Lesson[], date: string): Lesson[] {
  return lessons.filter((l) => l.status === "assistida" && l.watchedAt === date);
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return formatISODate(d);
}

export type WatchDay = { date: string; lessons: Lesson[] };

/** Histórico agrupado por dia, mais recente primeiro. */
export function watchHistory(lessons: Lesson[]): WatchDay[] {
  const byDate = new Map<string, Lesson[]>();
  for (const l of lessons) {
    if (l.status !== "assistida" || !l.watchedAt) continue;
    const bucket = byDate.get(l.watchedAt);
    if (bucket) bucket.push(l);
    else byDate.set(l.watchedAt, [l]);
  }
  return [...byDate.entries()]
    .map(([date, ls]) => ({
      date,
      lessons: ls.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Quantos dias de meta cumprida seguidos, contando para trás. O dia de hoje
 * só quebra a sequência se já tiver passado — ainda dá tempo de cumprir.
 */
export function currentStreak(
  lessons: Lesson[],
  today: string,
  goal: number
): number {
  if (goal <= 0) return 0;
  let streak = 0;
  let cursor = today;
  if (watchedOn(lessons, today).length < goal) cursor = addDays(today, -1);
  while (watchedOn(lessons, cursor).length >= goal) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export type Projection = {
  pending: number;
  watchedToday: number;
  /** Quanto ainda falta hoje para bater a meta. */
  remainingToday: number;
  /** Dias necessários para zerar, contando a partir de hoje. */
  daysNeeded: number | null;
  /** Data prevista para zerar a fila. */
  finishDate: string | null;
};

/**
 * Projeção simples de burn-down: assume a meta cumprida todo dia e ignora
 * aulas novas que ainda vão ser gravadas. Serve para orientar, não prever.
 */
export function project(
  lessons: Lesson[],
  today: string,
  goal: number
): Projection {
  const pending = pendingQueue(lessons, today).length;
  const watchedToday = watchedOn(lessons, today).length;
  const remainingToday = goal > 0 ? Math.max(0, goal - watchedToday) : 0;

  if (goal <= 0 || pending === 0) {
    return {
      pending,
      watchedToday,
      remainingToday,
      daysNeeded: pending === 0 ? 0 : null,
      finishDate: pending === 0 ? today : null,
    };
  }

  // Hoje só absorve o que ainda cabe na meta do dia. Se a meta de hoje já
  // foi batida, a fila só anda a partir de amanhã.
  // Mesmo contador usado por projectByCourse, para o total e cada disciplina
  // nunca se contradizerem.
  const offset = offsetForCount(pending, goal, remainingToday);
  return {
    pending,
    watchedToday,
    remainingToday,
    daysNeeded: daysFor(offset, remainingToday),
    finishDate: addDays(today, offset),
  };
}

/**
 * Em que dia (0 = hoje) a n-ésima aula da fila é assistida, dado que hoje já
 * só cabem `remainingToday` aulas e os dias seguintes cabem `goal`.
 */
function offsetForCount(
  count: number,
  goal: number,
  remainingToday: number
): number {
  if (count <= 0) return 0;
  if (count <= remainingToday) return 0;
  return Math.ceil((count - remainingToday) / goal);
}

/** Dias de estudo até esse offset — hoje só conta se ainda cabe aula hoje. */
function daysFor(offset: number, remainingToday: number): number {
  return offset + (remainingToday > 0 ? 1 : 0);
}

export type CourseProjection = {
  courseId: string;
  /** Aulas pendentes só dessa disciplina. */
  pending: number;
  /** Data da pendente mais antiga. */
  oldest: string;
  /** Dias se a meta inteira fosse dedicada só a essa disciplina. */
  focusDays: number | null;
  focusDate: string | null;
  /** Dias até a última aula dela sair da fila global (mais antigas primeiro). */
  queueDays: number | null;
  queueDate: string | null;
};

/**
 * Projeção por disciplina, em duas leituras honestas:
 *
 *   focus* — você gasta a meta inteira nessa matéria até zerá-la. Responde
 *            "quantos dias para ficar em dia nessa matéria".
 *   queue* — você segue a fila global (mais antigas primeiro) sem escolher
 *            matéria. A matéria fecha quando sua última pendente é consumida.
 *
 * As duas usam o mesmo contador de dias da projeção global, então nenhuma
 * disciplina pode "terminar" depois do total.
 */
export function projectByCourse(
  lessons: Lesson[],
  today: string,
  goal: number
): CourseProjection[] {
  const queue = pendingQueue(lessons, today);
  const remainingToday =
    goal > 0 ? Math.max(0, goal - watchedOn(lessons, today).length) : 0;

  // Posição (1-based) da última aula de cada disciplina na fila global.
  const lastSlot = new Map<string, number>();
  const counts = new Map<string, number>();
  const oldest = new Map<string, string>();
  queue.forEach((lesson, i) => {
    lastSlot.set(lesson.courseId, i + 1);
    counts.set(lesson.courseId, (counts.get(lesson.courseId) ?? 0) + 1);
    if (!oldest.has(lesson.courseId)) oldest.set(lesson.courseId, lesson.date);
  });

  return [...counts.entries()]
    .map(([courseId, pending]) => {
      if (goal <= 0) {
        return {
          courseId,
          pending,
          oldest: oldest.get(courseId) as string,
          focusDays: null,
          focusDate: null,
          queueDays: null,
          queueDate: null,
        };
      }
      const focusOffset = offsetForCount(pending, goal, remainingToday);
      const queueOffset = offsetForCount(
        lastSlot.get(courseId) as number,
        goal,
        remainingToday
      );
      return {
        courseId,
        pending,
        oldest: oldest.get(courseId) as string,
        focusDays: daysFor(focusOffset, remainingToday),
        focusDate: addDays(today, focusOffset),
        queueDays: daysFor(queueOffset, remainingToday),
        queueDate: addDays(today, queueOffset),
      };
    })
    .sort(
      (a, b) => b.pending - a.pending || a.oldest.localeCompare(b.oldest)
    );
}
