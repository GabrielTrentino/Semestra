import {
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  Pencil,
  Save,
  Trash2,
  X,
  CheckCircle2,
  Circle,
  Video,
  CalendarX,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  Course,
  Lesson,
  LessonStatus,
  Notebook,
  Program,
  Term,
  Weekday,
} from "../../lib/types";
import { WEEKDAY_SHORT } from "../../lib/types";
import { cssTint } from "../../lib/colors";
import { progressFor } from "../../lib/generateLessons";
import { formatBR, todayISO } from "../../lib/date";
import { LessonNotebook } from "../notebooks/LessonNotebook";

const ALL_DAYS: Weekday[] = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

type Props = {
  courses: Course[];
  lessons: Lesson[];
  terms: Term[];
  programs: Program[];
  notebooks: Notebook[];
  onUpdate: (id: string, patch: Partial<Course>) => void;
  onDelete: (id: string) => void;
  onSetLessonStatus: (lessonId: string, status: LessonStatus) => void;
  onNotebooksChange: (next: Notebook[]) => void;
};

const STATUS_LABEL: Record<LessonStatus, string> = {
  prevista: "Prevista",
  assistida: "Assistida",
  faltei: "Faltei",
  gravada: "Gravada p/ depois",
};

const STATUS_ICON: Record<LessonStatus, React.ComponentType<{ className?: string }>> = {
  prevista: Circle,
  assistida: CheckCircle2,
  faltei: CalendarX,
  gravada: Video,
};

export function CoursesPanel({
  courses,
  lessons,
  terms,
  programs,
  notebooks,
  onUpdate,
  onDelete,
  onSetLessonStatus,
  onNotebooksChange,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Course>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const today = todayISO();

  const lessonsByCourse = useMemo(() => {
    const m = new Map<string, Lesson[]>();
    for (const l of lessons) {
      const arr = m.get(l.courseId);
      if (arr) arr.push(l);
      else m.set(l.courseId, [l]);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
    return m;
  }, [lessons]);

  const programById = useMemo(
    () => new Map(programs.map((p) => [p.id, p])),
    [programs]
  );

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startEdit = (c: Course) => {
    setEditingId(c.id);
    setDraft({
      name: c.name,
      link: c.link,
      weekdays: c.weekdays,
      termLabels: c.termLabels ?? [],
      programId: c.programId,
    });
  };

  const commit = () => {
    if (!editingId) return;
    const patch = {
      ...draft,
      termLabels:
        draft.termLabels && draft.termLabels.length > 0
          ? draft.termLabels
          : undefined,
    };
    onUpdate(editingId, patch);
    setEditingId(null);
    setDraft({});
  };

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

  if (courses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
        Nenhuma disciplina ainda. Abra <strong>Configurações → Importar do
        WhatsApp</strong> para começar.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {courses.map((c) => {
        const editing = editingId === c.id;
        const isExpanded = expanded.has(c.id);
        const courseLessons = lessonsByCourse.get(c.id) ?? [];
        const program = c.programId ? programById.get(c.programId) : undefined;
        return (
          <li
            key={c.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            style={{ borderLeftColor: c.color, borderLeftWidth: 4 }}
          >
            {editing ? (
              <div className="p-4 space-y-3">
                <input
                  value={draft.name ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
                  placeholder="Nome da disciplina"
                />
                <input
                  value={draft.link ?? ""}
                  placeholder="Link padrão da aula (Zoom, Meet…)"
                  onChange={(e) =>
                    setDraft({ ...draft, link: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
                />
                <select
                  value={draft.programId ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      programId: e.target.value || undefined,
                    })
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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={commit}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-1 text-xs"
                  >
                    <Save className="h-3 w-3" /> Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500"
                  >
                    <X className="h-3 w-3" /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <header className="p-3 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(c.id)}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                    title={isExpanded ? "Recolher" : "Ver aulas"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpand(c.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                      {c.weekdays.map((d) => (
                        <span
                          key={d}
                          className="rounded-full px-2 py-0.5"
                          style={{
                            background: cssTint(c.color, 0.14),
                            color: c.color,
                          }}
                        >
                          {WEEKDAY_SHORT[d]}
                        </span>
                      ))}
                      {(c.termLabels ?? []).map((t) => (
                        <span
                          key={t}
                          className="rounded-full px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          {t}
                        </span>
                      ))}
                      {program && (
                        <span className="rounded-full px-2 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-500">
                          {program.institution}
                        </span>
                      )}
                    </div>
                    <ProgressRow
                      lessons={courseLessons}
                      today={today}
                      color={c.color}
                    />
                  </button>
                  <div className="flex gap-1 shrink-0">
                    {c.link && (
                      <a
                        href={c.link}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600"
                        title={c.link}
                      >
                        <LinkIcon className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `Remover "${c.name}"? As aulas também serão apagadas.`
                          )
                        ) {
                          onDelete(c.id);
                        }
                      }}
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 px-3 py-2">
                    {courseLessons.length === 0 ? (
                      <div className="text-sm text-slate-500 py-4 text-center">
                        Nenhuma aula gerada. Defina os períodos letivos e dias
                        da semana no editar.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {courseLessons.map((l, i) => (
                          <LessonRow
                            key={l.id}
                            index={i + 1}
                            lesson={l}
                            course={c}
                            notebook={notebooks.find(
                              (n) => n.lessonId === l.id
                            )}
                            onStatusChange={onSetLessonStatus}
                            onNotebooksChange={onNotebooksChange}
                            allNotebooks={notebooks}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function LessonRow({
  index,
  lesson,
  course,
  notebook,
  onStatusChange,
  onNotebooksChange,
  allNotebooks,
}: {
  index: number;
  lesson: Lesson;
  course: Course;
  notebook: Notebook | undefined;
  onStatusChange: (id: string, s: LessonStatus) => void;
  onNotebooksChange: (next: Notebook[]) => void;
  allNotebooks: Notebook[];
}) {
  const [open, setOpen] = useState(false);
  const Icon = STATUS_ICON[lesson.status];
  const today = todayISO();
  const isPast = lesson.date < today;
  const isToday = lesson.date === today;

  const ensureNotebook = (): Notebook => {
    if (notebook) return notebook;
    const nb: Notebook = {
      id: crypto.randomUUID(),
      courseId: course.id,
      lessonId: lesson.id,
      title: `Aula ${index} — ${course.name}`,
      updatedAt: new Date().toISOString(),
      blocks: [],
    };
    onNotebooksChange([...allNotebooks, nb]);
    return nb;
  };

  const updateNotebook = (updated: Notebook) =>
    onNotebooksChange(
      allNotebooks.find((n) => n.id === updated.id)
        ? allNotebooks.map((n) => (n.id === updated.id ? updated : n))
        : [...allNotebooks, updated]
    );

  return (
    <li>
      <div
        className={`py-1.5 flex items-center gap-2 ${
          isToday ? "font-medium" : ""
        }`}
      >
        <button
          type="button"
          onClick={() =>
            onStatusChange(
              lesson.id,
              lesson.status === "assistida" ? "prevista" : "assistida"
            )
          }
          className={`p-1 rounded-full ${
            lesson.status === "assistida"
              ? "text-emerald-600"
              : "text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
          title={
            lesson.status === "assistida"
              ? "Desmarcar"
              : "Marcar como assistida"
          }
        >
          <Icon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!notebook) ensureNotebook();
            setOpen((v) => !v);
          }}
          className="flex-1 min-w-0 text-left text-sm flex items-center gap-2"
        >
          <span className="w-12 shrink-0 text-xs text-slate-500">
            Aula {index}
          </span>
          <span className="shrink-0 text-xs text-slate-500">
            {formatBR(lesson.date)}
          </span>
          <span className="shrink-0 text-[11px] text-slate-400">
            {WEEKDAY_SHORT[lesson.weekday]}
          </span>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
              lesson.status === "assistida"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : lesson.status === "faltei"
                ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                : isPast
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {STATUS_LABEL[lesson.status]}
          </span>
          {open ? (
            <ChevronDown className="h-3 w-3 text-slate-400" />
          ) : (
            <ChevronRight className="h-3 w-3 text-slate-400" />
          )}
        </button>
        <select
          value={lesson.status}
          onChange={(e) =>
            onStatusChange(lesson.id, e.target.value as LessonStatus)
          }
          className="text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {(["prevista", "assistida", "faltei", "gravada"] as LessonStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            )
          )}
        </select>
      </div>
      {open && (
        <div className="pb-3 pl-9 pr-1">
          <LessonNotebook
            notebook={notebook ?? ensureNotebook()}
            onChange={updateNotebook}
            course={course}
            onDelete={() => {
              if (!notebook) return;
              onNotebooksChange(allNotebooks.filter((n) => n.id !== notebook.id));
              setOpen(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

function ProgressRow({
  lessons,
  today,
  color,
}: {
  lessons: Lesson[];
  today: string;
  color: string;
}) {
  const p = progressFor(lessons, today);
  if (p.total === 0) {
    return (
      <div className="mt-2 text-xs text-slate-500">
        Nenhuma aula gerada (sem dia ou fora do período).
      </div>
    );
  }
  const widthWatched = (p.watched / p.total) * 100;
  const widthMissed = (p.missed / p.total) * 100;
  const widthPastPending = (p.pastPending / p.total) * 100;
  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
        <span
          className="h-full"
          style={{ width: `${widthWatched}%`, background: color }}
          title={`Assistidas: ${p.watched}`}
        />
        <span
          className="h-full bg-red-400"
          style={{ width: `${widthMissed}%` }}
          title={`Faltei: ${p.missed}`}
        />
        <span
          className="h-full bg-amber-300"
          style={{ width: `${widthPastPending}%` }}
          title={`Passadas sem marcar: ${p.pastPending}`}
        />
      </div>
      <div className="text-[11px] text-slate-500 flex gap-3 flex-wrap">
        <span>
          <strong className="text-slate-900 dark:text-slate-100">
            {p.watched}
          </strong>{" "}
          assistidas
        </span>
        {p.missed > 0 && (
          <span className="text-red-600">{p.missed} faltei</span>
        )}
        {p.recorded > 0 && (
          <span className="text-slate-500">{p.recorded} p/ depois</span>
        )}
        {p.pastPending > 0 && (
          <span className="text-amber-600">
            {p.pastPending} passadas s/ marcar
          </span>
        )}
        <span>
          <strong className="text-slate-900 dark:text-slate-100">
            {p.upcoming}
          </strong>{" "}
          restantes
        </span>
        <span className="text-slate-400">de {p.total} totais</span>
      </div>
    </div>
  );
}
