"use client";

import * as React from "react";

type LaborLogEditorProps = {
  phaseCodes: string[];
};

type LaborRow = {
  id: number;
};

export function LaborLogEditor({ phaseCodes }: LaborLogEditorProps) {
  const [rows, setRows] = React.useState<LaborRow[]>([{ id: 1 }]);

  function addRow() {
    setRows((current) => [...current, { id: Date.now() }]);
  }

  function removeRow(id: number) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  return (
    <div className="labor-log">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Labor Log</p>
          <h3>Hours by person, phase, and task</h3>
        </div>
        <button className="button secondary" type="button" onClick={addRow}>
          Add labor line
        </button>
      </div>

      <div className="labor-row labor-header" aria-hidden="true">
        <span>Employee</span>
        <span>Hours</span>
        <span>Phase</span>
        <span>Task / notes</span>
        <span></span>
      </div>

      {rows.map((row) => (
        <div className="labor-row" key={row.id}>
          <input className="input" name="laborEmployee" placeholder="Employee" />
          <input className="input" name="laborHours" type="number" step="0.25" min="0" placeholder="Hours" />
          <select className="select" name="laborPhase" defaultValue="ROUGH_MEP">
            {phaseCodes.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
          </select>
          <input className="input" name="laborNotes" placeholder="Task / notes" />
          <button className="icon-button" type="button" onClick={() => removeRow(row.id)} aria-label="Remove labor line">
            x
          </button>
        </div>
      ))}
    </div>
  );
}
