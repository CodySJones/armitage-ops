import {
  calculateSchedule,
  type DependencyType,
  type ScheduleInputDependency,
  type ScheduleInputTask,
  type ScheduledTask,
} from "./schedule-engine.ts";

export type ImportedSchedule = {
  tasks: ScheduleInputTask[];
  dependencies: ScheduleInputDependency[];
};

export type CalculatedScheduleImport = ImportedSchedule & {
  projectStart: string;
  projectFinish: string;
  calculatedTasks: ScheduledTask[];
};

type JsonSchedule = {
  projectStart?: string;
  tasks?: Array<{
    id?: string;
    name?: string;
    durationDays?: number | string | null;
    predecessors?: string | null;
    dependencies?: Array<{
      predecessorId?: string;
      successorId?: string;
      type?: string;
      lagDays?: number | string | null;
    }>;
  }>;
  dependencies?: Array<{
    predecessorId?: string;
    successorId?: string;
    type?: string;
    lagDays?: number | string | null;
  }>;
};

const dependencyPattern = /^(.+?)(FS|SS|FF|SF)?([+-]\d+)?$/i;

export function parseAndCalculateScheduleImport(input: string, fallbackProjectStart: string): CalculatedScheduleImport {
  const imported = parseScheduleImport(input);
  const projectStart = parseProjectStart(input) || fallbackProjectStart;
  const result = calculateSchedule(imported.tasks, imported.dependencies, projectStart);

  return {
    ...imported,
    projectStart: result.projectStart,
    projectFinish: result.projectFinish,
    calculatedTasks: result.tasks,
  };
}

export function parseScheduleImport(input: string): ImportedSchedule {
  const trimmed = input.trim();

  if (!trimmed) {
    return { tasks: [], dependencies: [] };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonSchedule(trimmed);
  }

  return parseCsvSchedule(trimmed);
}

function parseProjectStart(input: string) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("{")) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed) as JsonSchedule;
    return typeof parsed.projectStart === "string" ? parsed.projectStart : "";
  } catch {
    return "";
  }
}

function parseJsonSchedule(input: string): ImportedSchedule {
  const parsed = JSON.parse(input) as JsonSchedule | NonNullable<JsonSchedule["tasks"]>;
  const source: JsonSchedule = Array.isArray(parsed) ? { tasks: parsed } : parsed;
  const tasks = normalizeTasks(source.tasks ?? []);
  const dependencies = normalizeDependencies(source.dependencies ?? []);

  for (const task of source.tasks ?? []) {
    dependencies.push(...parsePredecessorList(task.predecessors ?? "", String(task.id ?? ""), tasks));
    dependencies.push(...normalizeDependencies(task.dependencies ?? [], String(task.id ?? "")));
  }

  return { tasks, dependencies };
}

function parseCsvSchedule(input: string): ImportedSchedule {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);

  if (rows.length < 2) {
    throw new Error("Schedule CSV needs a header row and at least one task row.");
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const dataRows = rows.slice(1);
  const rawTasks = dataRows.map((row, index) => {
    const value = (name: string) => row[header.indexOf(name)]?.trim() ?? "";
    const id = value("id") || value("taskid") || value("task id") || String(index + 1);

    return {
      id,
      name: value("name") || value("task") || `Task ${id}`,
      durationDays: value("durationdays") || value("duration days") || value("duration") || "1",
      predecessors: value("predecessors") || value("predecessor") || value("dependencies"),
    };
  });

  const tasks = normalizeTasks(rawTasks);
  const dependencies = rawTasks.flatMap((task) => parsePredecessorList(task.predecessors, task.id, tasks));

  return { tasks, dependencies };
}

function normalizeTasks(rawTasks: NonNullable<JsonSchedule["tasks"]>): ScheduleInputTask[] {
  return rawTasks.map((task, index) => {
    const id = String(task.id || index + 1).trim();
    const name = String(task.name || `Task ${id}`).trim();

    if (!id) {
      throw new Error(`Task ${index + 1} is missing an id.`);
    }

    return {
      id,
      name,
      durationDays: parseInteger(task.durationDays, 1),
    };
  });
}

function normalizeDependencies(
  rawDependencies: NonNullable<JsonSchedule["dependencies"]>,
  defaultSuccessorId = "",
): ScheduleInputDependency[] {
  return rawDependencies.map((dependency) => ({
    predecessorId: String(dependency.predecessorId || "").trim(),
    successorId: String(dependency.successorId || defaultSuccessorId).trim(),
    type: normalizeDependencyType(dependency.type),
    lagDays: parseInteger(dependency.lagDays, 0),
  }));
}

function parsePredecessorList(value: string, successorId: string, tasks: ScheduleInputTask[]) {
  const taskIds = new Set(tasks.map((task) => task.id));

  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(dependencyPattern);
      if (!match) {
        throw new Error(`Invalid predecessor entry: ${item}`);
      }

      const predecessorId = match[1].trim();
      if (!taskIds.has(predecessorId)) {
        throw new Error(`Unknown predecessor task in import: ${predecessorId}`);
      }

      return {
        predecessorId,
        successorId,
        type: normalizeDependencyType(match[2]),
        lagDays: parseInteger(match[3], 0),
      };
    });
}

function normalizeDependencyType(value: string | undefined): DependencyType {
  const normalized = String(value || "FS").toUpperCase();
  if (normalized === "FS" || normalized === "SS" || normalized === "FF" || normalized === "SF") {
    return normalized;
  }

  throw new Error(`Unsupported dependency type: ${value}`);
}

function parseInteger(value: string | number | null | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}
