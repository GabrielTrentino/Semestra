import type { AcademicCalendar, Course, Lesson, Weekday } from "./types";

const DAY_KEYS: Exclude<Weekday, "DOM">[] = [
  "SEG",
  "TER",
  "QUA",
  "QUI",
  "SEX",
  "SAB",
];

/**
 * Produz uma Lesson por (disciplina × dia de aula) usando o calendário
 * acadêmico. Pula semanas de férias/recesso. Se `course.termLabel` estiver
 * definido, considera apenas as semanas daquele trimestre.
 */
export function generateLessonsForCourse(
  course: Course,
  calendar: AcademicCalendar,
  existingByKey: Map<string, Lesson> = new Map()
): Lesson[] {
  const lessons: Lesson[] = [];
  const terms = course.termLabels;
  for (const week of calendar.weeks) {
    if (week.kind !== "aulas") continue;
    if (terms && terms.length > 0 && !terms.includes(week.label)) continue;
    for (const d of DAY_KEYS) {
      if (!course.weekdays.includes(d)) continue;
      const iso = week.dates[d];
      if (!iso) continue;
      const key = `${course.id}|${iso}`;
      const existing = existingByKey.get(key);
      lessons.push(
        existing ?? {
          id: key,
          courseId: course.id,
          date: iso,
          weekday: d,
          status: "prevista",
          link: course.link,
        }
      );
    }
  }
  return lessons;
}

export function regenerateAllLessons(
  courses: Course[],
  calendar: AcademicCalendar,
  existing: Lesson[]
): Lesson[] {
  const index = new Map(existing.map((l) => [`${l.courseId}|${l.date}`, l]));
  const courseIds = new Set(courses.map((c) => c.id));
  const out: Lesson[] = [];
  // Mantém aulas pontuais criadas à mão (que pertençam a disciplinas ainda
  // existentes). As recorrentes serão reconstruídas abaixo.
  for (const l of existing) {
    if (l.oneOff && courseIds.has(l.courseId)) out.push(l);
  }
  for (const c of courses) {
    const generated = generateLessonsForCourse(c, calendar, index);
    // Evita duplicar se já houver uma one-off na mesma data+curso.
    const takenKeys = new Set(
      out.filter((l) => l.courseId === c.id).map((l) => l.date)
    );
    for (const g of generated) {
      if (!takenKeys.has(g.date)) out.push(g);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export type CourseProgress = {
  total: number;
  past: number;
  upcoming: number;
  watched: number;
  missed: number;
  recorded: number;
  pastPending: number;
};

export function progressFor(
  lessons: Lesson[],
  today: string
): CourseProgress {
  let past = 0,
    upcoming = 0,
    watched = 0,
    missed = 0,
    recorded = 0,
    pastPending = 0;
  for (const l of lessons) {
    const isPast = l.date < today;
    if (isPast) past++;
    else upcoming++;
    if (l.status === "assistida") watched++;
    else if (l.status === "faltei") missed++;
    else if (l.status === "gravada") recorded++;
    else if (isPast) pastPending++;
  }
  return {
    total: lessons.length,
    past,
    upcoming,
    watched,
    missed,
    recorded,
    pastPending,
  };
}
