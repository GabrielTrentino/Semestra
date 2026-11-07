import type { Weekday } from "./types";

export const PT_BR_WEEKDAYS: Weekday[] = [
  "DOM",
  "SEG",
  "TER",
  "QUA",
  "QUI",
  "SEX",
  "SAB",
];

export function parseISODate(iso: string): Date {
  // iso = YYYY-MM-DD → create local-midnight Date
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekdayOf(iso: string): Weekday {
  return PT_BR_WEEKDAYS[parseISODate(iso).getDay()];
}

export function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatBRLong(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function todayISO(): string {
  return formatISODate(new Date());
}

export function daysBetween(a: string, b: string): number {
  const ms =
    parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
