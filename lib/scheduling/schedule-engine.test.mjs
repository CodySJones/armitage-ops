import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateSchedule } from "./schedule-engine.ts";

describe("calculateSchedule", () => {
  it("schedules finish-to-start dependencies across working days", () => {
    const result = calculateSchedule(
      [
        { id: "demo", name: "Demo", durationDays: 2 },
        { id: "rough", name: "Rough MEP", durationDays: 3 },
      ],
      [{ predecessorId: "demo", successorId: "rough", type: "FS" }],
      "2026-04-06",
    );

    assert.equal(result.projectFinish, "2026-04-10");
    assert.deepEqual(
      result.tasks.map((task) => [task.id, task.startDate, task.finishDate, task.critical]),
      [
        ["demo", "2026-04-06", "2026-04-07", true],
        ["rough", "2026-04-08", "2026-04-10", true],
      ],
    );
  });

  it("supports start-to-start, finish-to-finish, and start-to-finish links with lag", () => {
    const result = calculateSchedule(
      [
        { id: "prep", name: "Prep", durationDays: 4 },
        { id: "inspect", name: "Inspection", durationDays: 1 },
        { id: "photos", name: "Photo closeout", durationDays: 1 },
        { id: "handoff", name: "Handoff", durationDays: 2 },
      ],
      [
        { predecessorId: "prep", successorId: "inspect", type: "SS", lagDays: 1 },
        { predecessorId: "prep", successorId: "photos", type: "FF" },
        { predecessorId: "inspect", successorId: "handoff", type: "SF", lagDays: 1 },
      ],
      "2026-04-06",
    );

    const byId = Object.fromEntries(result.tasks.map((task) => [task.id, task]));

    assert.equal(byId.inspect.startDate, "2026-04-07");
    assert.equal(byId.photos.startDate, "2026-04-09");
    assert.equal(byId.handoff.startDate, "2026-04-07");
    assert.equal(byId.handoff.finishDate, "2026-04-08");
  });

  it("skips weekends and holidays", () => {
    const result = calculateSchedule(
      [
        { id: "a", name: "A", durationDays: 1 },
        { id: "b", name: "B", durationDays: 1 },
      ],
      [{ predecessorId: "a", successorId: "b", type: "FS", lagDays: 1 }],
      "2026-04-10",
      { holidays: ["2026-04-13"] },
    );

    assert.equal(result.tasks[0].finishDate, "2026-04-10");
    assert.equal(result.tasks[1].startDate, "2026-04-15");
  });

  it("rejects circular dependencies", () => {
    assert.throws(
      () =>
        calculateSchedule(
          [
            { id: "a", name: "A", durationDays: 1 },
            { id: "b", name: "B", durationDays: 1 },
          ],
          [
            { predecessorId: "a", successorId: "b", type: "FS" },
            { predecessorId: "b", successorId: "a", type: "FS" },
          ],
          "2026-04-06",
        ),
      /circular/i,
    );
  });
});
