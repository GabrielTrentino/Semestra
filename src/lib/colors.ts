export const COURSE_PALETTE = [
  "#2563eb", // blue
  "#16a34a", // green
  "#db2777", // pink
  "#ea580c", // orange
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#ca8a04", // yellow
  "#dc2626", // red
];

export function pickColor(seed: number): string {
  return COURSE_PALETTE[seed % COURSE_PALETTE.length];
}

export function cssTint(hex: string, alpha = 0.12): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
