import { Save } from "lucide-react";
import type { Course, Program, Term, Weekday } from "../../lib/types";
import { WEEKDAY_SHORT } from "../../lib/types";

export const ALL_DAYS: Weekday[] = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

/**
 * Formulário de disciplina, compartilhado pela aba Disciplinas e pela tela
 * de Instituições. Os dois precisam dos mesmos campos; duplicar o JSX só
 * garantiria que um dos dois ficasse para trás na próxima mudança.
 *
 * O componente não guarda estado: quem chama é dono do rascunho e decide o
 * que fazer no salvar (criar ou atualizar).
 */
export function CourseForm({
  draft,
  setDraft,
  programs,
  terms,
  onSave,
  onCancel,
  saveLabel = "Salvar",
}: {
  draft: Partial<Course>;
  setDraft: (d: Partial<Course>) => void;
  programs: Program[];
  terms: Term[];
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const toggleDay = (d: Weekday) => {
    const current = (draft.weekdays ?? []) as Weekday[];
    setDraft({
      ...draft,
      weekdays: current.includes(d)
        ? current.filter((x) => x !== d)
        : [...current, d],
    });
  };

  const toggleTerm = (label: string) => {
    const current = draft.termLabels ?? [];
    setDraft({
      ...draft,
      termLabels: current.includes(label)
        ? current.filter((x) => x !== label)
        : [...current, label],
    });
  };

  const canSave = !!draft.name?.trim();

  return (
    <div className="space-y-3">
      <input
        value={draft.name ?? ""}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        placeholder="Nome da disciplina"
      />
      <input
        value={draft.link ?? ""}
        placeholder="Link padrão da aula (Zoom, Meet…)"
        onChange={(e) => setDraft({ ...draft, link: e.target.value })}
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
      />
      <select
        value={draft.programId ?? ""}
        onChange={(e) =>
          setDraft({ ...draft, programId: e.target.value || undefined })
        }
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
      >
        <option value="">— Sem instituição —</option>
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.institution}
          </option>
        ))}
      </select>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
          Períodos letivos (selecione os que a disciplina atravessa)
        </div>
        <div className="flex gap-1 flex-wrap">
          {terms.map((t) => {
            const on = (draft.termLabels ?? []).includes(t.label);
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => toggleTerm(t.label)}
                className={`rounded-full px-2 py-0.5 text-xs border ${
                  on
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
          Dias da semana
        </div>
        <div className="flex gap-1 flex-wrap">
          {ALL_DAYS.map((d) => {
            const active = (draft.weekdays ?? []).includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`rounded-full px-2 py-0.5 text-xs border ${
                  active
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-snug">
        As aulas são geradas a partir dos períodos letivos e dos dias da
        semana. Sem esses dois, a disciplina fica cadastrada mas sem aulas.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="inline-flex items-center gap-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-1 text-xs disabled:opacity-40"
        >
          <Save className="h-3 w-3" /> {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-xs text-slate-500"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
