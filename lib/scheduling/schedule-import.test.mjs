import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAndCalculateScheduleImport, parseScheduleImport } from "./schedule-import.ts";

describe("schedule import", () => {
  it("parses CSV tasks and predecessor strings", () => {
    const imported = parseScheduleImport(`id,name,duration,predecessors
1,Demo,2,
2,Rough MEP,3,1FS
3,Inspection,1,2SS+1`);

    assert.equal(imported.tasks.length, 3);
    assert.deepEqual(imported.dependencies, [
      { predecessorId: "1", successorId: "2", type: "FS", lagDays: 0 },
      { predecessorId: "2", successorId: "3", type: "SS", lagDays: 1 },
    ]);
  });

  it("calculates imported JSON schedules", () => {
    const calculated = parseAndCalculateScheduleImport(
      JSON.stringify({
        projectStart: "2026-04-06",
        tasks: [
          { id: "demo", name: "Demo", durationDays: 2 },
          { id: "rough", name: "Rough MEP", durationDays: 3, predecessors: "demoFS" },
        ],
      }),
      "2026-04-01",
    );

    assert.equal(calculated.projectFinish, "2026-04-10");
    assert.equal(calculated.calculatedTasks[1].startDate, "2026-04-08");
  });
});
