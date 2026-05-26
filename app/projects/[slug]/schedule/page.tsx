import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOpsProject,
  listProjectScheduleRevisions,
  listProjectScheduleTasks,
  saveProjectScheduleAction,
  setActiveRevisionAction,
  updateProjectScheduleTasksAction,
} from "@/lib/ops-store";
import { boardPhotoAccept } from "@/lib/upload-accept";

type SchedulePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProjectSchedulePage({ params }: SchedulePageProps) {
  const { slug } = await params;
  const [project, scheduleTasks, revisions] = await Promise.all([
    getOpsProject(slug),
    listProjectScheduleTasks(slug),
    listProjectScheduleRevisions(slug),
  ]);

  if (!project) {
    notFound();
  }

  async function action(formData: FormData) {
    "use server";
    await saveProjectScheduleAction(slug, formData);
  }

  async function updateScheduleTasks(formData: FormData) {
    "use server";
    await updateProjectScheduleTasksAction(slug, formData);
  }

  return (
    <div className="report-layout">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Project Onboarding</p>
            <h1>Import schedule for {project.name}</h1>
          </div>
          <span className="badge ready">Step 2 of 3</span>
        </div>
        <p className="subtitle">
          Materio gives the starting facts: task name, notes, start date, and end date. The ops schedule adds the missing control fields
          this app needs for variance tracking.
        </p>
      </section>

      <section className="card mobile-only">
        <p className="eyebrow">Desktop Workflow</p>
        <h2>Use the Mac for job import</h2>
        <p className="muted">
          Schedule import and Ops-field cleanup are admin setup steps. Field use should stay focused on whiteboard uploads
          and end-of-day reports.
        </p>
        <div className="button-row">
          <Link className="button" href={`/projects/${project.id}/board`}>Open field board</Link>
          <Link className="button secondary" href={`/projects/${project.id}/field-report/new`}>Field report</Link>
        </div>
      </section>

      <section className="columns desktop-only">
        <div className="card">
          <p className="eyebrow">Ops Schedule Bridge</p>
          <h2>Spreadsheet first</h2>
          <div className="list">
            <div className="list-item">
              <strong>Materio export gives</strong>
              <p className="muted">Task name, notes, start date, and end date. Keep those columns as source context.</p>
            </div>
            <div className="list-item">
              <strong>PM fills</strong>
              <p className="muted">phase_code, area, owner, dependency, milestone, readiness_note, and needs_pm_fill.</p>
            </div>
            <div className="list-item">
              <strong>Import columns</strong>
              <p className="muted">The app reads task_name, phase_code, area, planned_start, planned_finish, owner, dependency, and milestone.</p>
            </div>
            <div className="list-item">
              <strong>Expected blanks</strong>
              <p className="muted">Rows can be marked needs_pm_fill until the operational fields are clean enough to import.</p>
            </div>
          </div>
          <a className="button secondary" href="/ops-schedule-template.csv">Download CSV template</a>
        </div>

        <div className="card">
          <p className="eyebrow">Active Schedule</p>
          <h2>{scheduleTasks.length} task(s)</h2>
          {revisions.length > 0 ? (
            <div className="list">
              {revisions.map((rev) => (
                <div key={rev.id} className="list-item">
                  <div className="list-row">
                    <strong>Rev {rev.revisionNo} — {rev.reason || rev.importedFrom}</strong>
                    <span className="badge ready">{rev.isBaseline ? "Baseline" : rev.isActive ? "Active" : "Archived"}</span>
                  </div>
                  <p className="muted">{rev.taskCount} tasks · {rev.importedAt.slice(0, 10)}{rev.fileName ? ` · ${rev.fileName}` : ""}</p>
                  {!rev.isActive && (
                    <form action={setActiveRevisionAction.bind(null, slug, rev.id)}>
                      <button type="submit" className="button secondary">Set as working schedule</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No schedule imported yet.</p>
          )}
        </div>
      </section>

      <section className="card desktop-only">
        <form action={action} className="form-grid">
          <label className="file-field">
            <div>
              <div className="eyebrow">Spreadsheet schedule</div>
              <p className="muted">Export from Materio and import the raw CSV. Fill the missing Ops fields below after the rows load.</p>
            </div>
            <input className="input" name="scheduleFile" type="file" accept=".csv,.xlsx,.xls,.pdf" />
          </label>

          <label>
            <span className="eyebrow">Paste CSV schedule rows</span>
            <textarea
              className="textarea code-input"
              name="scheduleImportText"
              placeholder={`materio_task_name,materio_notes,materio_start,materio_end,task_name,phase_code,area,planned_start,planned_finish,owner,dependency,milestone,readiness_note,needs_pm_fill\nDemo protection,Protect floors,2026-06-01,2026-06-01,Demo protection,DEMO,Kitchen,2026-06-01,2026-06-01,Field crew,,no,Board can be made from this row,no\nRough electrical,Coordinate fixtures,2026-06-03,2026-06-05,Rough electrical,ROUGH_MEP,Kitchen,2026-06-03,2026-06-05,Electrician,Demo protection,no,Confirm cabinet layout before start,yes`}
            />
          </label>

          <label>
            <span className="eyebrow">First board date</span>
            <input className="input" type="date" name="boardDate" defaultValue={project.plannedStartDate || "2026-06-01"} />
          </label>

          <section className="file-field">
            <div>
              <div className="eyebrow">Today's whiteboard photo</div>
              <p className="muted">
                Upload the morning board as the plan record. The end-of-day report will prove whether this board worked.
              </p>
            </div>
            <input className="input" name="boardPhoto" type="file" accept={boardPhotoAccept} />
          </section>

          <label>
            <span className="eyebrow">Transcribe today's board tasks</span>
            <textarea
              className="textarea code-input"
              name="boardTaskText"
              placeholder={`One per line: task, phase code, area, owner, planned hours, dependency\nProtect kitchen floors,DEMO,Kitchen,Field crew,2,\nConfirm cabinet layout,CAB,Kitchen,PM,1,Updated drawings`}
            />
          </label>

          <label>
            <span className="eyebrow">Board notes</span>
            <textarea className="textarea" name="boardNotes" placeholder="Anything visible on the board that should be preserved as context." />
          </label>

          {revisions.length > 0 && (
            <label>
              <span className="eyebrow">Reason for this revision</span>
              <input
                className="input"
                name="revisionReason"
                placeholder="e.g. Owner approved 2-week delay on tile phase"
              />
            </label>
          )}

          <div className="button-row">
            <button className="button" type="submit">{revisions.length === 0 ? "Import baseline schedule" : "Import new revision"}</button>
            <Link className="button secondary" href={`/projects/${project.id}/board`}>Skip for now</Link>
          </div>
        </form>
      </section>

      {scheduleTasks.length > 0 ? (
        <section className="card desktop-only">
          <p className="eyebrow">Imported Tasks</p>
          <h2>Enrich Ops fields</h2>
          <p className="muted">
            Materio supplies the task name, notes, and dates. Add the operational fields here so reporting can enforce variance,
            readiness, ownership, and milestones.
          </p>
          <form action={updateScheduleTasks} className="form-grid">
            <div className="schedule-edit-list">
              {scheduleTasks.map((task) => (
                <div className="schedule-edit-row" key={task.id}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <div className="schedule-source">
                    <strong>{task.taskName}</strong>
                    <span>{task.plannedStart || "No start"} to {task.plannedFinish || "No finish"}</span>
                    {task.sourceNotes ? <p className="muted">{task.sourceNotes}</p> : null}
                  </div>
                  <label>
                    <span className="eyebrow">Phase</span>
                    <input className="input" name="phaseCode" defaultValue={task.phaseCode} placeholder="DEMO" />
                  </label>
                  <label>
                    <span className="eyebrow">Area</span>
                    <input className="input" name="area" defaultValue={task.area} placeholder="Kitchen" />
                  </label>
                  <label>
                    <span className="eyebrow">Owner</span>
                    <input className="input" name="owner" defaultValue={task.owner} placeholder="Field crew" />
                  </label>
                  <label>
                    <span className="eyebrow">Dependency</span>
                    <input className="input" name="dependency" defaultValue={task.dependency} placeholder="Task that must happen first" />
                  </label>
                  <label className="wide-field">
                    <span className="eyebrow">Readiness note</span>
                    <input className="input" name="readinessNote" defaultValue={task.readinessNote || ""} placeholder="What must be true before this can start?" />
                  </label>
                  <label className="check-field">
                    <input type="checkbox" name="milestoneTaskId" value={task.id} defaultChecked={task.milestone} />
                    <span>Milestone</span>
                  </label>
                  <label className="check-field">
                    <input type="checkbox" name="needsPmFillTaskId" value={task.id} defaultChecked={task.needsPmFill} />
                    <span>Needs PM fill</span>
                  </label>
                </div>
              ))}
            </div>
            <div className="button-row">
              <button className="button" type="submit">Save Ops fields</button>
              <Link className="button secondary" href={`/projects/${project.id}/board`}>Go to board</Link>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
