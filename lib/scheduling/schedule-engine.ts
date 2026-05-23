export type DependencyType = "FS" | "SS" | "FF" | "SF" | "CHECKLIST";

export type ScheduleInputTask = {
  id: string;
  name: string;
  durationDays?: number | null;
};

export type ScheduleInputDependency = {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays?: number | null;
};

export type WorkCalendarInput = {
  workingWeekdays?: number[];
  holidays?: string[];
};

export type ScheduledTask = ScheduleInputTask & {
  durationDays: number;
  startDate: string;
  finishDate: string;
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  totalSlackDays: number;
  critical: boolean;
};

export type ScheduleResult = {
  projectStart: string;
  projectFinish: string;
  tasks: ScheduledTask[];
};

type InternalTask = ScheduleInputTask & {
  durationDays: number;
  earlyStart: Date;
  earlyFinish: Date;
  lateStart: Date;
  lateFinish: Date;
};

type NormalizedDependency = {
  predecessorId: string;
  successorId: string;
  type: Exclude<DependencyType, "CHECKLIST">;
  lagDays: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateSchedule(
  tasks: ScheduleInputTask[],
  dependencies: ScheduleInputDependency[],
  projectStart: string,
  calendar: WorkCalendarInput = {},
): ScheduleResult {
  const workCalendar = createWorkCalendar(calendar);
  const taskMap = new Map<string, InternalTask>();

  for (const task of tasks) {
    if (taskMap.has(task.id)) {
      throw new Error(`Duplicate task id: ${task.id}`);
    }

    const durationDays = Math.max(0, Math.trunc(task.durationDays ?? 1));
    taskMap.set(task.id, {
      ...task,
      durationDays,
      earlyStart: new Date(0),
      earlyFinish: new Date(0),
      lateStart: new Date(0),
      lateFinish: new Date(0),
    });
  }

  const links = normalizeDependencies(dependencies, taskMap);
  const ordered = topologicalSort(taskMap, links);
  const start = workCalendar.adjustForward(parseDate(projectStart));

  for (const task of ordered) {
    let earlyStart = start;
    const incoming = links.filter((link) => link.successorId === task.id);

    for (const link of incoming) {
      const predecessor = mustGet(taskMap, link.predecessorId);
      earlyStart = maxDate(earlyStart, earliestStartFromDependency(predecessor, task.durationDays, link, workCalendar));
    }

    task.earlyStart = earlyStart;
    task.earlyFinish = finishFromStart(earlyStart, task.durationDays, workCalendar);
  }

  const projectFinish = ordered.reduce((finish, task) => maxDate(finish, task.earlyFinish), start);

  for (const task of [...ordered].reverse()) {
    let lateStart = subtractWorkingDays(projectFinish, Math.max(0, task.durationDays - 1), workCalendar);
    let lateFinish = projectFinish;
    const outgoing = links.filter((link) => link.predecessorId === task.id);

    for (const link of outgoing) {
      const successor = mustGet(taskMap, link.successorId);
      const bounds = latestBoundsFromDependency(task, successor, link, workCalendar);
      lateStart = minDate(lateStart, bounds.lateStart);
      lateFinish = minDate(lateFinish, bounds.lateFinish);
    }

    task.lateStart = lateStart;
    task.lateFinish = lateFinish;
  }

  return {
    projectStart: formatDate(start),
    projectFinish: formatDate(projectFinish),
    tasks: ordered.map((task) => {
      const totalSlackDays = workCalendar.diffWorkingDays(task.earlyStart, task.lateStart);

      return {
        id: task.id,
        name: task.name,
        durationDays: task.durationDays,
        startDate: formatDate(task.earlyStart),
        finishDate: formatDate(task.earlyFinish),
        earlyStart: formatDate(task.earlyStart),
        earlyFinish: formatDate(task.earlyFinish),
        lateStart: formatDate(task.lateStart),
        lateFinish: formatDate(task.lateFinish),
        totalSlackDays,
        critical: totalSlackDays === 0,
      };
    }),
  };
}

function normalizeDependencies(
  dependencies: ScheduleInputDependency[],
  taskMap: Map<string, InternalTask>,
): NormalizedDependency[] {
  return dependencies.flatMap((dependency) => {
    if (dependency.type === "CHECKLIST") {
      return [];
    }

    if (!taskMap.has(dependency.predecessorId)) {
      throw new Error(`Unknown predecessor task: ${dependency.predecessorId}`);
    }

    if (!taskMap.has(dependency.successorId)) {
      throw new Error(`Unknown successor task: ${dependency.successorId}`);
    }

    if (dependency.predecessorId === dependency.successorId) {
      throw new Error(`Task cannot depend on itself: ${dependency.predecessorId}`);
    }

    return [{
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type,
      lagDays: Math.trunc(dependency.lagDays ?? 0),
    }];
  });
}

function topologicalSort(taskMap: Map<string, InternalTask>, links: NormalizedDependency[]) {
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const id of taskMap.keys()) {
    outgoing.set(id, []);
    incomingCount.set(id, 0);
  }

  for (const link of links) {
    outgoing.get(link.predecessorId)?.push(link.successorId);
    incomingCount.set(link.successorId, (incomingCount.get(link.successorId) ?? 0) + 1);
  }

  const ready = [...incomingCount.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id);
  const ordered: InternalTask[] = [];

  while (ready.length > 0) {
    const id = ready.shift() as string;
    ordered.push(mustGet(taskMap, id));

    for (const successorId of outgoing.get(id) ?? []) {
      const nextCount = (incomingCount.get(successorId) ?? 0) - 1;
      incomingCount.set(successorId, nextCount);
      if (nextCount === 0) {
        ready.push(successorId);
      }
    }
  }

  if (ordered.length !== taskMap.size) {
    throw new Error("Schedule dependencies contain a circular link.");
  }

  return ordered;
}

function earliestStartFromDependency(
  predecessor: InternalTask,
  successorDurationDays: number,
  dependency: NormalizedDependency,
  calendar: ReturnType<typeof createWorkCalendar>,
) {
  if (dependency.type === "FS") {
    return addWorkingDays(predecessor.earlyFinish, dependency.lagDays + 1, calendar);
  }

  if (dependency.type === "SS") {
    return addWorkingDays(predecessor.earlyStart, dependency.lagDays, calendar);
  }

  if (dependency.type === "FF") {
    const requiredFinish = addWorkingDays(predecessor.earlyFinish, dependency.lagDays, calendar);
    return subtractWorkingDays(requiredFinish, Math.max(0, successorDurationDays - 1), calendar);
  }

  const requiredFinish = addWorkingDays(predecessor.earlyStart, dependency.lagDays, calendar);
  return subtractWorkingDays(requiredFinish, Math.max(0, successorDurationDays - 1), calendar);
}

function latestBoundsFromDependency(
  predecessor: InternalTask,
  successor: InternalTask,
  dependency: NormalizedDependency,
  calendar: ReturnType<typeof createWorkCalendar>,
) {
  if (dependency.type === "FS") {
    const lateFinish = subtractWorkingDays(successor.lateStart, dependency.lagDays + 1, calendar);
    return {
      lateFinish,
      lateStart: subtractWorkingDays(lateFinish, Math.max(0, predecessor.durationDays - 1), calendar),
    };
  }

  if (dependency.type === "SS") {
    const lateStart = subtractWorkingDays(successor.lateStart, dependency.lagDays, calendar);
    return {
      lateStart,
      lateFinish: finishFromStart(lateStart, predecessor.durationDays, calendar),
    };
  }

  if (dependency.type === "FF") {
    const lateFinish = subtractWorkingDays(successor.lateFinish, dependency.lagDays, calendar);
    return {
      lateFinish,
      lateStart: subtractWorkingDays(lateFinish, Math.max(0, predecessor.durationDays - 1), calendar),
    };
  }

  const lateStart = subtractWorkingDays(successor.lateFinish, dependency.lagDays, calendar);
  return {
    lateStart,
    lateFinish: finishFromStart(lateStart, predecessor.durationDays, calendar),
  };
}

function finishFromStart(start: Date, durationDays: number, calendar: ReturnType<typeof createWorkCalendar>) {
  return addWorkingDays(start, Math.max(0, durationDays - 1), calendar);
}

function createWorkCalendar(input: WorkCalendarInput) {
  const workingWeekdays = new Set(input.workingWeekdays ?? [1, 2, 3, 4, 5]);
  const holidays = new Set(input.holidays ?? []);

  function isWorkingDay(date: Date) {
    return workingWeekdays.has(date.getUTCDay()) && !holidays.has(formatDate(date));
  }

  return {
    isWorkingDay,
    adjustForward(date: Date) {
      let current = startOfUtcDay(date);
      while (!isWorkingDay(current)) {
        current = addCalendarDays(current, 1);
      }
      return current;
    },
    adjustBackward(date: Date) {
      let current = startOfUtcDay(date);
      while (!isWorkingDay(current)) {
        current = addCalendarDays(current, -1);
      }
      return current;
    },
    diffWorkingDays(start: Date, finish: Date) {
      let current = startOfUtcDay(start);
      const end = startOfUtcDay(finish);
      let days = 0;
      const step = current <= end ? 1 : -1;

      while (current.getTime() !== end.getTime()) {
        current = addCalendarDays(current, step);
        if (isWorkingDay(current)) {
          days += step;
        }
      }

      return days;
    },
  };
}

function addWorkingDays(date: Date, amount: number, calendar: ReturnType<typeof createWorkCalendar>) {
  if (amount === 0) {
    return amount >= 0 ? calendar.adjustForward(date) : calendar.adjustBackward(date);
  }

  let remaining = Math.abs(amount);
  let current = startOfUtcDay(date);
  const step = amount > 0 ? 1 : -1;

  while (remaining > 0) {
    current = addCalendarDays(current, step);
    if (calendar.isWorkingDay(current)) {
      remaining -= 1;
    }
  }

  return current;
}

function subtractWorkingDays(date: Date, amount: number, calendar: ReturnType<typeof createWorkCalendar>) {
  return addWorkingDays(date, -amount, calendar);
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addCalendarDays(date: Date, amount: number) {
  return new Date(startOfUtcDay(date).getTime() + amount * MS_PER_DAY);
}

function formatDate(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function maxDate(a: Date, b: Date) {
  return a > b ? a : b;
}

function minDate(a: Date, b: Date) {
  return a < b ? a : b;
}

function mustGet<T>(map: Map<string, T>, id: string) {
  const value = map.get(id);
  if (!value) {
    throw new Error(`Unknown task: ${id}`);
  }
  return value;
}
