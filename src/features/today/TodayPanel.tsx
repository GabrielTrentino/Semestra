import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Video,
  CalendarX,
  Link as LinkIcon,
  Plus,
  Trash2,
  FileText,
  CalendarClock,
  GraduationCap,
} from "lucide-react";
import type {
  Assignment,
  AssignmentType,
  Course,
  Lesson,
  LessonStatus,
  Program,
} from "../../lib/types";
import { WEEKDAY_SHORT } from "../../lib/types";
import {
  daysBetween,
  formatBR,
  todayISO,
  weekdayOf,
} from "../../lib/date";
import { cssTint } from "../../lib/colors";

const WINDOW_DAYS = 14;

type Props = {
  lessons: Lesson[];
  courses: Course[];
  assignments: Assignment[];
  programs: Program[];
  onSetLessonStatus: (id: string, s: LessonStatus) => void;
  onAddLesson: (l: Lesson) => void;
  onAddAssignment: (a: Assignment) => void;
  onUpdateAssignment: (id: string, patch: Partial<Assignment>) => void;
  onDeleteAssignment: (id: string) => void;
};

const STATUS_ICON: Record<LessonStatus, React.ComponentType<{ className?: string }>> = {
  prevista: Circle,
  assistida: CheckCircle2,
  faltei: CalendarX,
  gravada: Video,
};

const ASSIGNMENT_LABEL: Record<AssignmentType, string> = {
  trabalho: "Trabalho",
  prova: "Prova",
  leitura: "Leitura",
  atividade: "Atividade",
  evento: "Evento",
};

export function TodayPanel({
  lessons,
  courses,
  assignments,
  programs,
  onSetLessonStatus,
  onAddLesson,
  onAddAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
}: Props) {
  const [showAdd, setShowAdd] = useState<"assignment" | "lesson" | null>(null);
  const today = todayISO();
  const courseById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses]
  );
  const programById = useMemo(
    () => new Map(programs.map((p) => [p.id, p])),
    [programs]
  );

  const items = useMemo(() => {
    const result: {
      date: string;
      kind: "lesson" | "assignment";
      lesson?: Lesson;
      assignment?: Assignment;
    }[] = [];
    for (const l of lessons) {
      const diff = daysBetween(today, l.date);
      if (diff < 0 || diff > WINDOW_DAYS) continue;
      result.push({ date: l.date, kind: "lesson", lesson: l });
    }
    for (const a of assignments) {
      const diff = daysBetween(today, a.dueDate);
      if (diff < -3 || diff > WINDOW_DAYS + 7) continue;
      result.push({ date: a.dueDate, kind: "assignment", assignment: a });
    }
    result.sort((a, b) => a.date.localeCompare(b.date));
    return result;
  }, [lessons, assignments, today]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const it of items) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold">Próximos {WINDOW_DAYS} dias</h2>
        <span className="text-xs text-slate-500">
          ({items.length} itens de {programs.length} instituição
          {programs.length === 1 ? "" : "s"})
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setShowAdd("lesson")}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
          >
            <GraduationCap className="h-3.5 w-3.5" />
            + Aula pontual
          </button>
          <button
            type="button"
            onClick={() => setShowAdd("assignment")}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Evento / entrega
          </button>
        </div>
      </header>

      {showAdd === "assignment" && (
        <AddAssignmentForm
          courses={courses}
          programs={programs}
          onCancel={() => setShowAdd(null)}
          onSave={(a) => {
            onAddAssignment(a);
            setShowAdd(null);
          }}
        />
      )}
      {showAdd === "lesson" && (
        <AddLessonForm
          courses={courses}
          programs={programs}
          onCancel={() => setShowAdd(null)}
          onSave={(l) => {
            onAddLesson(l);
            setShowAdd(null);
          }}
        />
      )}

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
          Nada nas próximas duas semanas. Cadastre disciplinas em{" "}
          <strong>Configurações</strong> ou crie um evento acima.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, dayItems]) => (
            <section key={date}>
              <header className="mb-2 flex items-center gap-2">
                <div className="text-sm font-semibold">
                  {formatBR(date)} ·{" "}
                  <span className="text-slate-500 font-normal">
                    {WEEKDAY_SHORT[weekdayOf(date)]}
                  </span>
                </div>
                <RelativeTag iso={date} today={today} />
              </header>
              <ul className="space-y-2">
                {dayItems.map((it, i) =>
                  it.kind === "lesson" && it.lesson ? (
                    <LessonCard
                      key={`l-${it.lesson.id}-${i}`}
                      lesson={it.lesson}
                      course={courseById.get(it.lesson.courseId)}
                      program={
                        courseById.get(it.lesson.courseId)?.programId
                          ? programById.get(
                              courseById.get(it.lesson.courseId)!.programId!
                            )
                          : undefined
                      }
                      onStatusChange={onSetLessonStatus}
                    />
                  ) : it.kind === "assignment" && it.assignment ? (
                    <AssignmentCard
                      key={`a-${it.assignment.id}-${i}`}
                      assignment={it.assignment}
                      course={
                        it.assignment.courseId
                          ? courseById.get(it.assignment.courseId)
                          : undefined
                      }
                      program={
                        it.assignment.programId
                          ? programById.get(it.assignment.programId)
                          : undefined
                      }
                      onUpdate={onUpdateAssignment}
                      onDelete={onDeleteAssignment}
                    />
                  ) : null
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonCard({
  lesson,
  course,
  program,
  onStatusChange,
}: {
  lesson: Lesson;
  course: Course | undefined;
  program: Program | undefined;
  onStatusChange: (id: string, s: LessonStatus) => void;
}) {
  if (!course) return null;
  const Icon = STATUS_ICON[lesson.status];
  return (
    <li
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center gap-3"
      style={{ borderLeftColor: course.color, borderLeftWidth: 4 }}
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
      >
        <Icon className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate" style={{ color: course.color }}>
          {course.name}
          {lesson.oneOff && (
            <span className="ml-2 text-[10px] uppercase text-amber-600">
              pontual
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
          {program && (
            <span
              className="rounded-full px-2 py-0.5"
              style={{
                background: cssTint(course.color, 0.14),
                color: course.color,
              }}
            >
              {program.institution}
            </span>
          )}
          {lesson.link && (
            <a
              href={lesson.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <LinkIcon className="h-3 w-3" />
              Entrar na aula
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function AssignmentCard({
  assignment,
  course,
  program,
  onUpdate,
  onDelete,
}: {
  assignment: Assignment;
  course: Course | undefined;
  program: Program | undefined;
  onUpdate: (id: string, patch: Partial<Assignment>) => void;
  onDelete: (id: string) => void;
}) {
  const color = course?.color ?? program?.color ?? "#64748b";
  return (
    <li
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center gap-3"
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <button
        type="button"
        onClick={() =>
          onUpdate(assignment.id, {
            status:
              assignment.status === "entregue" ? "pendente" : "entregue",
          })
        }
        className={`p-1 rounded-full ${
          assignment.status === "entregue"
            ? "text-emerald-600"
            : "text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
        title="Alternar entregue"
      >
        {assignment.status === "entregue" ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : assignment.type === "evento" ? (
          <CalendarClock className="h-5 w-5" />
        ) : (
          <FileText className="h-5 w-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">
          <span
            className="text-[10px] uppercase rounded-full px-1.5 py-0.5 mr-2"
            style={{ background: cssTint(color, 0.18), color }}
          >
            {ASSIGNMENT_LABEL[assignment.type]}
          </span>
          {assignment.title}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
          {program && <span>{program.institution}</span>}
          {course && <span>· {course.name}</span>}
          {assignment.link && (
            <a
              href={assignment.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <LinkIcon className="h-3 w-3" />
              link
            </a>
          )}
          {assignment.status === "atrasada" && (
            <span className="text-red-600">atrasada</span>
          )}
        </div>
        {assignment.note && (
          <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">
            {assignment.note}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          if (confirm("Remover este item?")) onDelete(assignment.id);
        }}
        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
        title="Remover"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function AddAssignmentForm({
  courses,
  programs,
  onCancel,
  onSave,
}: {
  courses: Course[];
  programs: Program[];
  onCancel: () => void;
  onSave: (a: Assignment) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AssignmentType>("trabalho");
  const [dueDate, setDueDate] = useState(todayISO());
  const [programId, setProgramId] = useState<string>(programs[0]?.id ?? "");
  const [courseId, setCourseId] = useState<string>("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const availableCourses = courses.filter(
    (c) => !programId || c.programId === programId
  );
  const save = () => {
    if (!title.trim() || !dueDate) return;
    onSave({
      id: crypto.randomUUID(),
      title: title.trim(),
      type,
      dueDate,
      programId: programId || undefined,
      courseId: courseId || undefined,
      link: link.trim() || undefined,
      note: note.trim() || undefined,
      status: "pendente",
    });
  };
  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="text-sm font-semibold">Novo evento / entrega</div>
      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm md:col-span-2"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AssignmentType)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        >
          {(Object.keys(ASSIGNMENT_LABEL) as AssignmentType[]).map((t) => (
            <option key={t} value={t}>
              {ASSIGNMENT_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        />
        <select
          value={programId}
          onChange={(e) => {
            setProgramId(e.target.value);
            setCourseId("");
          }}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        >
          <option value="">— Instituição —</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.institution}
            </option>
          ))}
        </select>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        >
          <option value="">— Disciplina (opcional) —</option>
          {availableCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Link (opcional)"
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm md:col-span-2"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          rows={2}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm md:col-span-2 resize-y"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!title.trim() || !dueDate}
          className="rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-500"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function AddLessonForm({
  courses,
  programs,
  onCancel,
  onSave,
}: {
  courses: Course[];
  programs: Program[];
  onCancel: () => void;
  onSave: (l: Lesson) => void;
}) {
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [programId, setProgramId] = useState<string>("");

  const availableCourses = courses.filter(
    (c) => !programId || c.programId === programId
  );

  const save = () => {
    if (!courseId || !date) return;
    const course = courses.find((c) => c.id === courseId);
    onSave({
      id: crypto.randomUUID(),
      courseId,
      date,
      weekday: weekdayOf(date),
      status: "prevista",
      oneOff: true,
      link: link.trim() || course?.link,
      title: title.trim() || undefined,
    });
  };

  if (courses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
        Cadastre uma disciplina antes de criar uma aula pontual (em{" "}
        <strong>Disciplinas</strong>).
        <button
          type="button"
          onClick={onCancel}
          className="ml-2 text-xs text-slate-500 underline"
        >
          fechar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="text-sm font-semibold">Aula pontual</div>
      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={programId}
          onChange={(e) => {
            setProgramId(e.target.value);
            const first = courses.find(
              (c) => !e.target.value || c.programId === e.target.value
            );
            if (first) setCourseId(first.id);
          }}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        >
          <option value="">Qualquer instituição</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.institution}
            </option>
          ))}
        </select>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        >
          {availableCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Link (herda da disciplina se vazio)"
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm md:col-span-2"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!courseId || !date}
          className="rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Criar aula
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-500"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function RelativeTag({ iso, today }: { iso: string; today: string }) {
  const diff = daysBetween(today, iso);
  let label = "";
  let tone = "text-slate-500";
  if (diff === 0) {
    label = "hoje";
    tone = "text-emerald-600 dark:text-emerald-400 font-medium";
  } else if (diff === 1) {
    label = "amanhã";
    tone = "text-slate-700 dark:text-slate-300";
  } else if (diff === -1) {
    label = "ontem";
  } else if (diff > 1) {
    label = `em ${diff} dias`;
  } else {
    label = `há ${-diff} dias`;
  }
  return <span className={`text-xs ${tone}`}>({label})</span>;
}
