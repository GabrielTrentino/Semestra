import type { Weekday } from "./types";

export type ParsedCourse = {
  name: string;
  link?: string;
  weekdays: Weekday[];
  rawDaysText: string;
  /** Linhas originais do bloco, para a UI oferecer "trocar o nome por esta
   *  linha" quando o parser escolher mal. */
  candidates: string[];
  /** Heurística: `true` quando o bloco parece ser uma disciplina (tem link
   *  OU tem dia da semana identificado). Blocos sem nenhum dos dois quase
   *  sempre são cabeçalho/rodapé da mensagem. */
  likely: boolean;
};

const WEEKDAY_MAP: { pattern: RegExp; day: Weekday }[] = [
  { pattern: /\bsegund/i, day: "SEG" },
  { pattern: /\bter[cç]/i, day: "TER" },
  { pattern: /\bquart/i, day: "QUA" },
  { pattern: /\bquint/i, day: "QUI" },
  { pattern: /\bsext/i, day: "SEX" },
  { pattern: /\bs[aá]bado/i, day: "SAB" },
  { pattern: /\bdomingo/i, day: "DOM" },
];

const LINK_RE = /(https?:\/\/[^\s]+)/i;

/**
 * Parses a WhatsApp-style class list such as:
 *
 *   🔹 Nome da disciplina
 *   📅 Segunda e Quarta-feiras
 *   🔗 https://zoom.us/...
 *
 * Blocks are separated by the "🔹" marker; the parser also tolerates plain
 * text (no emojis) and extra lines (titles, teachers, etc.).
 */
export function parseWhatsAppClasses(input: string): ParsedCourse[] {
  if (!input.trim()) return [];
  const normalized = input.replace(/\r\n/g, "\n");

  // Split by 🔹 markers; if none, treat whole input as one block.
  const blocks = normalized.includes("🔹")
    ? normalized.split(/\n?🔹\s*/).map((s) => s.trim()).filter(Boolean)
    : normalized
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean);

  const out: ParsedCourse[] = [];
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    // Name: first non-empty line, stripped of leading emoji/pipe
    const name = lines[0]
      .replace(/^[📚🔹🔖➡️•\-\*\s]+/u, "")
      .replace(/\s+$/u, "");

    let link: string | undefined;
    let daysText = "";

    for (const l of lines.slice(1)) {
      const linkMatch = l.match(LINK_RE);
      if (linkMatch) link = linkMatch[1];
      if (/📅|dia|feira/i.test(l) && !daysText) {
        daysText = l;
      }
    }
    // If days still empty, try to find any line with weekday words.
    if (!daysText) {
      daysText =
        lines.find((l) => WEEKDAY_MAP.some((w) => w.pattern.test(l))) ?? "";
    }

    const weekdays = Array.from(
      new Set(
        WEEKDAY_MAP.filter(({ pattern }) => pattern.test(daysText)).map(
          ({ day }) => day
        )
      )
    );

    if (!name) continue;

    // Candidates for the title: all lines that aren't the day/link marker.
    const candidates = lines
      .map((l) => l.replace(/^[📚🔹🔖➡️•\-\*\s]+/u, "").trim())
      .filter(
        (l) =>
          l &&
          !LINK_RE.test(l) &&
          !/^📅/.test(l) &&
          !WEEKDAY_MAP.some((w) => w.pattern.test(l))
      );

    out.push({
      name,
      link,
      weekdays,
      rawDaysText: daysText,
      candidates: Array.from(new Set(candidates)),
      likely: weekdays.length > 0 || !!link,
    });
  }
  return out;
}
