import { useMemo, useState } from "react";
import {
  ClipboardPaste,
  Link as LinkIcon,
  Check,
  AlertTriangle,
} from "lucide-react";
import { parseWhatsAppClasses } from "../../lib/parseWhatsApp";
import type { ParsedCourse } from "../../lib/parseWhatsApp";
import { pickColor } from "../../lib/colors";
import { WEEKDAY_SHORT } from "../../lib/types";
import type { Course, Term, Weekday } from "../../lib/types";

type Draft = {
  include: boolean;
  name: string;
  link: string;
  weekdays: Weekday[];
  candidates: string[];
  likely: boolean;
};

type Props = {
  programId?: string;
  existingCount: number;
  terms: Term[];
  currentTermLabel?: string;
  programs: { id: string; name: string; institution: string }[];
  onImport: (courses: Course[]) => void;
};

const EXAMPLE = `📚 Links das Aulas (Eng Soft)

🔹 PB: Desenvolvimento Back-End
📅  Sexta-feiras
🔗 https://infnet.zoom.us/j/92607601079

🔹 Desenvolvimento de Serviços Web e Testes com Java
📅 Segunda e Quartas-feiras
🔗 https://infnet.zoom.us/j/99279625885

🔹 Desenvolvimento Web com .NET e Bases de Dados
📅 Terça e Quinta-feiras
🔗 https://infnet.zoom.us/j/98848358589`;

const ALL_DAYS: Weekday[] = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

function parsedToDraft(p: ParsedCourse): Draft {
  return {
    include: p.likely,
    name: p.name,
    link: p.link ?? "",
    weekdays: p.weekdays,
    candidates: p.candidates,
    likely: p.likely,
  };
}

export function WhatsAppImporter({
  programId,
  existingCount,
  terms,
  currentTermLabel,
  programs,
  onImport,
}: Props) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [termLabels, setTermLabels] = useState<string[]>(
    currentTermLabel ? [currentTermLabel] : []
  );
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    programId ?? ""
  );
  const [imported, setImported] = useState(false);

  const parsed = useMemo(() => parseWhatsAppClasses(text), [text]);

  const loadFromText = () => {
    setDrafts(parsed.map(parsedToDraft));
  };

  const toggleTerm = (label: string) =>
    setTermLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );

  const handleImport = () => {
    const base = existingCount;
    const selected = drafts.filter((d) => d.include && d.name.trim());
    if (selected.length === 0) return;
    const courses: Course[] = selected.map((d, i) => ({
      id: crypto.randomUUID(),
      name: d.name.trim(),
      color: pickColor(base + i),
      link: d.link.trim() || undefined,
      weekdays: d.weekdays,
      programId: selectedProgramId || undefined,
      termLabels: termLabels.length > 0 ? termLabels : undefined,
    }));
    onImport(courses);
    setImported(true);
    setTimeout(() => setImported(false), 2500);
    setText("");
    setDrafts([]);
  };

  const patch = (idx: number, p: Partial<Draft>) =>
    setDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...p } : d))
    );

  const toggleDay = (idx: number, d: Weekday) => {
    const cur = drafts[idx].weekdays;
    patch(idx, {
      weekdays: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d],
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4" />
            Colar lista do WhatsApp
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Cole o texto do grupo. O Semestra identifica cada disciplina, mas
            o parser erra em cabeçalhos e nomes com dois-pontos — por isso
            <strong> revise antes de importar</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setText(EXAMPLE)}
          className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-2"
        >
          Usar exemplo
        </button>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Cole aqui o texto do grupo…"
        rows={8}
        spellCheck={false}
        className="w-full resize-y rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm font-mono"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          disabled={parsed.length === 0}
          onClick={loadFromText}
          className="rounded-lg bg-slate-200 dark:bg-slate-800 px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          Analisar texto ({parsed.length} {parsed.length === 1 ? "bloco" : "blocos"})
        </button>
        <label className="text-sm text-slate-500 inline-flex items-center gap-2">
          Instituição:
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
          >
            <option value="">— sem vínculo —</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.institution}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-slate-500 space-y-1">
          <div className="text-xs uppercase tracking-wide">
            Período(s) letivo(s) — selecione um ou mais para disciplinas que
            atravessam trimestres (ex.: PB).
          </div>
          <div className="flex flex-wrap gap-1">
            {terms.map((t) => {
              const on = termLabels.includes(t.label);
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
                  title={`${t.firstDate.slice(5)} a ${t.lastDate.slice(5)} · ${t.weekCount} sem.`}
                >
                  {t.label}
                </button>
              );
            })}
            {termLabels.length === 0 && (
              <span className="text-xs text-slate-400 self-center">
                (ano inteiro)
              </span>
            )}
          </div>
        </div>
        {imported && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <Check className="h-4 w-4" />
            Disciplinas importadas
          </span>
        )}
      </div>

      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Revisão ({drafts.filter((d) => d.include).length} selecionadas)
          </div>
          <ul className="space-y-3">
            {drafts.map((d, i) => (
              <li
                key={i}
                className={`rounded-lg border p-3 space-y-2 ${
                  d.include
                    ? "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50"
                    : "border-dashed border-slate-300 dark:border-slate-700 opacity-70"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    id={`inc-${i}`}
                    type="checkbox"
                    checked={d.include}
                    onChange={(e) =>
                      patch(i, { include: e.target.checked })
                    }
                    className="mt-1"
                  />
                  <label
                    htmlFor={`inc-${i}`}
                    className="flex-1 text-xs text-slate-500 cursor-pointer"
                  >
                    {d.include ? "Importar" : "Ignorar este bloco"}
                  </label>
                  {!d.likely && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400"
                      title="Nenhum dia da semana ou link detectado"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      duvidoso
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Nome
                  </label>
                  <input
                    value={d.name}
                    onChange={(e) => patch(i, { name: e.target.value })}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                  />
                  {d.candidates.length > 1 && (
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      <span className="text-slate-500 self-center">
                        candidatos:
                      </span>
                      {d.candidates
                        .filter((c) => c !== d.name)
                        .slice(0, 5)
                        .map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => patch(i, { name: c })}
                            className="rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-800"
                          >
                            {c.length > 50 ? c.slice(0, 50) + "…" : c}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Link
                  </label>
                  <input
                    value={d.link}
                    onChange={(e) => patch(i, { link: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm font-mono text-xs"
                  />
                  {d.link && (
                    <a
                      href={d.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <LinkIcon className="h-3 w-3" />
                      abrir
                    </a>
                  )}
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500">
                    Dias
                  </label>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {ALL_DAYS.map((day) => {
                      const active = d.weekdays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(i, day)}
                          className={`rounded-full px-2 py-0.5 text-xs border ${
                            active
                              ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                              : "border-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {WEEKDAY_SHORT[day]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={drafts.filter((d) => d.include).length === 0}
              className="rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              Importar selecionadas
            </button>
            <button
              type="button"
              onClick={() => setDrafts([])}
              className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Descartar revisão
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
