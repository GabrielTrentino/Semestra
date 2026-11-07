export type Weekday = "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB" | "DOM";

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  DOM: "Domingo",
  SEG: "Segunda",
  TER: "Terça",
  QUA: "Quarta",
  QUI: "Quinta",
  SEX: "Sexta",
  SAB: "Sábado",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  DOM: "Dom",
  SEG: "Seg",
  TER: "Ter",
  QUA: "Qua",
  QUI: "Qui",
  SEX: "Sex",
  SAB: "Sáb",
};

export type Program = {
  id: string;
  name: string;
  institution: string;
  color: string;
  /** Qual calendário acadêmico usar. `null` ou ausente = instituição sem
   *  calendário; lessons só existem se forem pontuais. */
  calendarId?: "infnet-2026" | null;
};

export type Course = {
  id: string;
  name: string;
  color: string;
  link?: string;
  weekdays: Weekday[];
  programId?: string;
  /** Rótulos de período letivo (ex.: ["2026 Trim 3", "2026 Trim 4"]). Vazio
   *  = ano inteiro (ou nenhuma aula se a disciplina for pontual). */
  termLabels?: string[];
};

export type LessonStatus = "prevista" | "assistida" | "faltei" | "gravada";

export type Lesson = {
  id: string;
  courseId: string;
  date: string; // YYYY-MM-DD
  weekday: Weekday;
  status: LessonStatus;
  title?: string;
  link?: string;
  note?: string;
  /** Lições criadas à mão (fora do calendário recorrente). */
  oneOff?: boolean;
};

export type AssignmentType =
  | "trabalho"
  | "prova"
  | "leitura"
  | "atividade"
  | "evento";

export type AssignmentStatus = "pendente" | "entregue" | "atrasada";

export type Assignment = {
  id: string;
  courseId?: string;
  programId?: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  type: AssignmentType;
  weight?: number;
  grade?: number;
  status: AssignmentStatus;
  note?: string;
  link?: string;
};

export type NotebookBlock =
  | {
      id: string;
      kind: "markdown";
      source: string;
    }
  | {
      id: string;
      kind: "code";
      language: "csharp" | "java";
      source: string;
      lastRun?: {
        at: string;
        stdout: string;
        stderr: string;
        exitCode: number | null;
        elapsedMs: number;
        error?: string;
      };
    };

export type Notebook = {
  id: string;
  courseId?: string;
  lessonId?: string;
  title: string;
  updatedAt: string; // ISO datetime
  blocks: NotebookBlock[];
};

export type Term = {
  label: string; // ex.: "2026 Trim 4"
  firstDate: string; // YYYY-MM-DD
  lastDate: string;
  weekCount: number;
};

export type AcademicWeek = {
  label: string;
  week: string;
  kind: "aulas" | "ferias" | "recesso" | "outro";
  dates: Record<"SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB", string | null>;
  observacoes: string;
};

export type AcademicCalendar = {
  year: number;
  source: string;
  weeks: AcademicWeek[];
  holidays: { date: string; description: string }[];
};
