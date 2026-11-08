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
  if (remainingToday > 0) {
    const afterToday = Math.max(0, pending - remainingToday);
    const extraDays = Math.ceil(afterToday / goal);
    return {
      pending,
      watchedToday,
      remainingToday,
      daysNeeded: 1 + extraDays,
      finishDate: addDays(today, extraDays),
    };
  }

  const extraDays = Math.ceil(pending / goal);
  return {
    pending,
    watchedToday,
    remainingToday,
    daysNeeded: extraDays,
    finishDate: addDays(today, extraDays),
  };
}
