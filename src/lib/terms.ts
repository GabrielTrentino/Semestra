import type { AcademicCalendar, Term } from "./types";

/** Lista os períodos letivos (trimestres) a partir do calendário acadêmico,
 *  considerando apenas semanas de aula. */
export function extractTerms(calendar: AcademicCalendar): Term[] {
  const map = new Map<string, { dates: string[]; weekCount: number }>();
  for (const w of calendar.weeks) {
    if (w.kind !== "aulas") continue;
    const entry = map.get(w.label) ?? { dates: [], weekCount: 0 };
    for (const d of Object.values(w.dates)) {
      if (d) entry.dates.push(d);
    }
    entry.weekCount += 1;
    map.set(w.label, entry);
  }
  const terms: Term[] = [];
  for (const [label, { dates, weekCount }] of map) {
    const sorted = dates.sort();
    terms.push({
      label,
      firstDate: sorted[0],
      lastDate: sorted[sorted.length - 1],
      weekCount,
    });
  }
  return terms.sort((a, b) => a.firstDate.localeCompare(b.firstDate));
}

/** Rótulo do trimestre que contém a data informada. */
export function termLabelForDate(
  terms: Term[],
  iso: string
): string | undefined {
  for (const t of terms) {
    if (iso >= t.firstDate && iso <= t.lastDate) return t.label;
  }
  return undefined;
}

/** Trimestre "corrente" para a data informada — o que contém, ou o próximo
 *  trimestre ainda por começar. */
export function currentTerm(terms: Term[], iso: string): Term | undefined {
  return (
    terms.find((t) => iso >= t.firstDate && iso <= t.lastDate) ??
    terms.find((t) => t.firstDate > iso) ??
    terms[terms.length - 1]
  );
}
