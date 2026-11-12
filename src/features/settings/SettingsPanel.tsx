import { useState } from "react";
import {
  Building2,
  ClipboardPaste,
  Database,
  FolderOpen,
  X,
  Plus,
  Trash2,
  Save,
  Pencil,
} from "lucide-react";
import type { Course, Program, Term } from "../../lib/types";
import { WEEKDAY_SHORT } from "../../lib/types";
import { CourseForm } from "../courses/CourseForm";
import { WhatsAppImporter } from "../importer/WhatsAppImporter";
import { COURSE_PALETTE } from "../../lib/colors";

type Props = {
  programs: Program[];
  courses: Course[];
  terms: Term[];
  currentTermLabel?: string;
  dataFolder: string | null;
  onClose: () => void;
  onSaveProgram: (p: Program) => void;
  onDeleteProgram: (id: string) => void;
  onImportCourses: (newCourses: Course[]) => void;
  onAddCourse: (c: Course) => void;
  onUpdateCourse: (id: string, patch: Partial<Course>) => void;
  onDeleteCourse: (id: string) => void;
  onExport: () => void;
  onImportBackup: () => void;
  onReset: () => void;
  onChangeDataFolder: () => Promise<unknown>;
  onRevealDataFolder: () => void;
};

type Section = "instituicoes" | "whatsapp" | "backup";

const SECTIONS: { id: Section; label: string; icon: typeof Building2 }[] = [
  { id: "instituicoes", label: "Instituições", icon: Building2 },
  { id: "whatsapp", label: "Importar do WhatsApp", icon: ClipboardPaste },
  { id: "backup", label: "Backup e dados", icon: Database },
];

export function SettingsPanel(props: Props) {
  const [section, setSection] = useState<Section>("instituicoes");
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-start justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="w-full max-w-4xl h-[92vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl grid grid-cols-[180px_1fr] grid-rows-[1fr]">
        <aside className="border-r border-slate-200 dark:border-slate-800 p-3 space-y-1 bg-slate-50 dark:bg-slate-900 overflow-y-auto min-h-0">
          <div className="px-2 py-1 text-xs uppercase tracking-wide text-slate-500">
            Configurações
          </div>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-left ${
                section === id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </aside>
        <div className="overflow-y-auto min-h-0">
          <header className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-950 z-10">
            <h2 className="text-base font-semibold">
              {SECTIONS.find((s) => s.id === section)?.label}
            </h2>
            <button
              type="button"
              onClick={props.onClose}
              className="ml-auto p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="p-4">
            {section === "instituicoes" && (
              <ProgramsEditor
                programs={props.programs}
                existingCourses={props.courses}
                terms={props.terms}
                onSave={props.onSaveProgram}
                onDelete={props.onDeleteProgram}
                onImportCourses={props.onImportCourses}
                onAddCourse={props.onAddCourse}
                onUpdateCourse={props.onUpdateCourse}
                onDeleteCourse={props.onDeleteCourse}
              />
            )}
            {section === "whatsapp" && (
              <WhatsAppImporter
                programId={props.programs[0]?.id}
                programs={props.programs}
                existingCount={props.courses.length}
                terms={props.terms}
                currentTermLabel={props.currentTermLabel}
                onImport={(cs) => {
                  props.onImportCourses(cs);
                  props.onClose();
                }}
              />
            )}
            {section === "backup" && (
              <BackupSection
                dataFolder={props.dataFolder}
                onExport={props.onExport}
                onImport={props.onImportBackup}
                onReset={props.onReset}
                onChangeDataFolder={props.onChangeDataFolder}
                onRevealDataFolder={props.onRevealDataFolder}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const INFNET_2026_CATALOG: { name: string }[] = [
  { name: "Desenvolvimento de Serviços Web e Testes com Java" },
  { name: "Desenvolvimento Web com .NET e Bases de Dados" },
  { name: "Fundamentos de Desenvolvimento com C#" },
  { name: "Fundamentos de Desenvolvimento com Java" },
  { name: "Introdução à Programação com Python" },
  { name: "Introdução a Visualização de Dados e SQL" },
  { name: "Projeto de Bloco: Desenvolvimento Back-End" },
  { name: "Python para Processamento de Dados" },
  { name: "SQL e Modelagem Relacional" },
];

function ProgramsEditor({
  programs,
  existingCourses,
  terms,
  onSave,
  onDelete,
  onImportCourses,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
}: {
  programs: Program[];
  existingCourses: Course[];
  terms: Term[];
  onSave: (p: Program) => void;
  onDelete: (id: string) => void;
  onImportCourses: (cs: Course[]) => void;
  onAddCourse: (c: Course) => void;
  onUpdateCourse: (id: string, patch: Partial<Course>) => void;
  onDeleteCourse: (id: string) => void;
}) {
  const infnetProgram = programs.find((p) => p.calendarId === "infnet-2026");
  const existingNames = new Set(
    existingCourses.map((c) => c.name.toLowerCase().trim())
  );
  const catalogToAdd = INFNET_2026_CATALOG.filter(
    (c) => !existingNames.has(c.name.toLowerCase().trim())
  );
  const importCatalog = () => {
    if (!infnetProgram) return;
    const colors = COURSE_PALETTE;
    const toAdd: Course[] = catalogToAdd.map((c, i) => ({
      id: crypto.randomUUID(),
      name: c.name,
      color: colors[(existingCourses.length + i) % colors.length],
      weekdays: [],
      programId: infnetProgram.id,
      termLabels: /projeto de bloco/i.test(c.name)
        ? ["2026 Trim 3", "2026 Trim 4"]
        : undefined,
    }));
    onImportCourses(toAdd);
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Program>>({});
  const [adding, setAdding] = useState(false);

  const startEdit = (p: Program) => {
    setEditingId(p.id);
    setDraft({ ...p });
    setAdding(false);
  };
  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setDraft({
      id: crypto.randomUUID(),
      name: "",
      institution: "",
      color:
        COURSE_PALETTE[programs.length % COURSE_PALETTE.length],
      calendarId: null,
    });
  };
  const save = () => {
    if (!draft.name || !draft.institution || !draft.id) return;
    onSave(draft as Program);
    setDraft({});
    setEditingId(null);
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Cadastre cada formação/instituição (graduação, pós, MBA, curso livre).
        A instituição aparece em todas as outras telas pra filtrar o que você
        quer ver.
      </p>

      <ul className="space-y-2">
        {programs.map((p) => {
          const editing = editingId === p.id;
          return (
            <li
              key={p.id}
              className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"
              style={{ borderLeftColor: p.color, borderLeftWidth: 4 }}
            >
              {editing ? (
                <ProgramForm
                  draft={draft}
                  setDraft={setDraft}
                  onSave={save}
                  onCancel={() => {
                    setDraft({});
                    setEditingId(null);
                  }}
                />
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.institution}
                      {p.calendarId && ` · calendário ${p.calendarId}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
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
                          `Remover "${p.name}"? As disciplinas não serão apagadas, mas ficarão sem instituição.`
                        )
                      )
                        onDelete(p.id);
                    }}
                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {!editing && (
                <CoursesOfProgram
                  programId={p.id}
                  courses={existingCourses}
                  programs={programs}
                  terms={terms}
                  onAdd={onAddCourse}
                  onUpdate={onUpdateCourse}
                  onDelete={onDeleteCourse}
                />
              )}
            </li>
          );
        })}
      </ul>

      {existingCourses.some((c) => !c.programId) && (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3">
          <div className="text-sm font-medium">Sem instituição</div>
          <p className="text-xs text-slate-500">
            Disciplinas que ainda não pertencem a nenhuma formação. Edite cada
            uma para escolher onde ela entra.
          </p>
          <CoursesOfProgram
            programId={null}
            courses={existingCourses}
            programs={programs}
            terms={terms}
            onAdd={onAddCourse}
            onUpdate={onUpdateCourse}
            onDelete={onDeleteCourse}
          />
        </div>
      )}

      {adding ? (
        <div className="rounded-lg border border-slate-300 dark:border-slate-700 p-3">
          <ProgramForm
            draft={draft}
            setDraft={setDraft}
            onSave={save}
            onCancel={() => {
              setDraft({});
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={startAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 text-sm"
        >
          <Plus className="h-4 w-4" /> Adicionar instituição
        </button>
      )}

      {infnetProgram && catalogToAdd.length > 0 && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-3">
          <div className="text-sm font-medium mb-1">
            Catálogo INFNET 2026 — Eng. Software
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
            {catalogToAdd.length} disciplina
            {catalogToAdd.length === 1 ? "" : "s"} do curso ainda não{" "}
            {catalogToAdd.length === 1 ? "está cadastrada" : "estão cadastradas"}.
            Inclui PB Back-End já marcado para Trim 3+4. Dias da semana e links
            você preenche depois em Disciplinas.
          </p>
          <ul className="text-xs text-slate-600 dark:text-slate-300 mb-2 space-y-0.5 list-disc pl-4">
            {catalogToAdd.map((c) => (
              <li key={c.name}>{c.name}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={importCatalog}
            className="rounded-md bg-blue-600 text-white px-3 py-1.5 text-xs font-medium"
          >
            Cadastrar {catalogToAdd.length}{" "}
            {catalogToAdd.length === 1 ? "disciplina" : "disciplinas"} em{" "}
            {infnetProgram.name}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Disciplinas de uma instituição (ou, com programId null, as que ainda não
 * têm instituição). Cadastrar e manter a grade era possível só pela aba
 * Disciplinas ou pelos importadores; aqui fica junto de quem é dona dela.
 *
 * Usa o mesmo CourseForm da aba Disciplinas: os campos que geram aula
 * (períodos letivos e dias da semana) não podem divergir entre as telas.
 */
function CoursesOfProgram({
  programId,
  courses,
  programs,
  terms,
  onAdd,
  onUpdate,
  onDelete,
}: {
  programId: string | null;
  courses: Course[];
  programs: Program[];
  terms: Term[];
  onAdd: (c: Course) => void;
  onUpdate: (id: string, patch: Partial<Course>) => void;
  onDelete: (id: string) => void;
}) {
  const mine = courses.filter((c) => (c.programId ?? null) === programId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<Course>>({});

  const reset = () => {
    setDraft({});
    setEditingId(null);
    setAdding(false);
  };

  const startAdd = () => {
    setEditingId(null);
    setAdding(true);
    setDraft({
      id: crypto.randomUUID(),
      name: "",
      color: COURSE_PALETTE[courses.length % COURSE_PALETTE.length],
      weekdays: [],
      termLabels: [],
      programId: programId ?? undefined,
    });
  };

  const startEdit = (c: Course) => {
    setAdding(false);
    setEditingId(c.id);
    setDraft({
      ...c,
      weekdays: c.weekdays ?? [],
      termLabels: c.termLabels ?? [],
    });
  };

  const commit = () => {
    const name = draft.name?.trim();
    if (!name) return;
    // termLabels vazio significa "ano todo"; guardar [] faria o gerador de
    // aulas tratar como lista explícita e vazia.
    const termLabels =
      draft.termLabels && draft.termLabels.length > 0
        ? draft.termLabels
        : undefined;
    if (adding) {
      onAdd({ ...(draft as Course), name, termLabels });
    } else if (editingId) {
      onUpdate(editingId, { ...draft, name, termLabels });
    }
    reset();
  };

  return (
    <div className="mt-3 border-t border-slate-200 dark:border-slate-800 pt-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
        Disciplinas ({mine.length})
      </div>

      {mine.length === 0 && !adding && (
        <p className="text-xs text-slate-400 mb-2">
          Nenhuma disciplina cadastrada aqui ainda.
        </p>
      )}

      <ul className="space-y-1">
        {mine.map((c) =>
          editingId === c.id ? (
            <li
              key={c.id}
              className="rounded-md border border-slate-300 dark:border-slate-700 p-2"
            >
              <CourseForm
                draft={draft}
                setDraft={setDraft}
                programs={programs}
                terms={terms}
                onSave={commit}
                onCancel={reset}
              />
            </li>
          ) : (
            <li
              key={c.id}
              className="rounded-md border border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center gap-2"
              style={{ borderLeftColor: c.color, borderLeftWidth: 3 }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate" style={{ color: c.color }}>
                  {c.name}
                </div>
                <div className="text-[11px] text-slate-500">
                  {c.termLabels && c.termLabels.length > 0
                    ? c.termLabels.join(" · ")
                    : "ano todo"}
                  {" · "}
                  {c.weekdays.length > 0
                    ? c.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")
                    : "sem dias definidos"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => startEdit(c)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                title="Editar disciplina"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Remover "${c.name}"? As aulas e os cadernos dela também serão apagados.`
                    )
                  ) {
                    onDelete(c.id);
                    if (editingId === c.id) reset();
                  }
                }}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600 shrink-0"
                title="Remover disciplina"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          )
        )}
      </ul>

      {adding ? (
        <div className="mt-2 rounded-md border border-slate-300 dark:border-slate-700 p-2">
          <CourseForm
            draft={draft}
            setDraft={setDraft}
            programs={programs}
            terms={terms}
            onSave={commit}
            onCancel={reset}
            saveLabel="Cadastrar"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={startAdd}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Plus className="h-3 w-3" /> Adicionar disciplina
        </button>
      )}
    </div>
  );
}

function ProgramForm({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: Partial<Program>;
  setDraft: (p: Partial<Program>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={draft.name ?? ""}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Nome da formação (ex.: Pós em Gestão de TI)"
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        />
        <input
          value={draft.institution ?? ""}
          onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
          placeholder="Instituição (ex.: FGV)"
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        />
        <select
          value={draft.calendarId ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              calendarId:
                e.target.value === "infnet-2026" ? "infnet-2026" : null,
            })
          }
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        >
          <option value="">Sem calendário (eventos pontuais)</option>
          <option value="infnet-2026">INFNET — Graduação 2026</option>
        </select>
        <div className="flex gap-1 flex-wrap items-center">
          <span className="text-xs text-slate-500">Cor:</span>
          {COURSE_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDraft({ ...draft, color: c })}
              className={`h-5 w-5 rounded-full ${
                draft.color === c
                  ? "ring-2 ring-slate-900 dark:ring-white"
                  : ""
              }`}
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.name || !draft.institution}
          className="inline-flex items-center gap-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-1 text-xs disabled:opacity-40"
        >
          <Save className="h-3 w-3" /> Salvar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function BackupSection({
  dataFolder,
  onExport,
  onImport,
  onReset,
  onChangeDataFolder,
  onRevealDataFolder,
}: {
  dataFolder: string | null;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
  onChangeDataFolder: () => Promise<unknown>;
  onRevealDataFolder: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
        <div className="flex items-center gap-2 text-sm font-medium mb-1">
          <FolderOpen className="h-4 w-4" />
          Pasta de dados
        </div>
        <div className="text-xs text-slate-500 mb-2">
          Estrutura dentro da pasta:{" "}
          <code>semestra-data.json</code> (programas, disciplinas, aulas,
          eventos) e <code>notebooks/&lt;id&gt;.json</code> (um arquivo por
          notebook). Mudar a pasta migra os dados atuais pra nova localização.
        </div>
        <div className="font-mono text-xs break-all bg-slate-100 dark:bg-slate-900 rounded p-2 mb-2">
          {dataFolder ?? "(não definido)"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onChangeDataFolder}
            className="rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 text-xs"
          >
            Trocar pasta…
          </button>
          {dataFolder && (
            <button
              type="button"
              onClick={onRevealDataFolder}
              className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs"
            >
              Abrir pasta
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Exporte um JSON de backup periodicamente — ele contém disciplinas,
        aulas, notebooks e eventos.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 text-sm"
        >
          Exportar backup (.json)
        </button>
        <button
          type="button"
          onClick={onImport}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        >
          Importar backup (.json)
        </button>
      </div>
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="text-sm font-medium text-red-600">Zona perigosa</div>
        <p className="text-xs text-slate-500 mt-1">
          Apaga tudo (disciplinas, aulas, notebooks, eventos). Não há como
          desfazer sem um backup.
        </p>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "Apagar todos os dados locais? Isso não pode ser desfeito."
              )
            )
              onReset();
          }}
          className="mt-2 rounded-md border border-red-300 dark:border-red-900 text-red-600 px-3 py-1.5 text-sm"
        >
          Limpar todos os dados
        </button>
      </div>
    </div>
  );
}
