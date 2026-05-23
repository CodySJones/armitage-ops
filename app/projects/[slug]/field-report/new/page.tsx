import { notFound } from "next/navigation";
import { createFieldReportAction, getDailyBoard, getOpsProject } from "@/lib/ops-store";
import { globalChangeOrderRules } from "@/lib/global-rules";
import { photoAccept } from "@/lib/upload-accept";
import { LaborLogEditor } from "@/components/labor-log-editor";

type NewFieldReportPageProps = {
  params: Promise<{ slug: string }>;
};

const phaseCodes = ["DEMO", "FRAMING", "ROUGH_MEP", "INSULATION", "DRYWALL", "TILE", "CABINETRY", "FINISH", "PUNCH"];
const varianceTypes = ["scope", "schedule", "labor", "cost", "quality", "legal", "hidden_condition", "client_request", "client_decision"];

export default async function NewFieldReportPage({ params }: NewFieldReportPageProps) {
  const { slug } = await params;
  const [project, boardTasks] = await Promise.all([getOpsProject(slug), getDailyBoard(slug)]);

  if (!project) {
    notFound();
  }

  async function submitReport(formData: FormData) {
    "use server";
    await createFieldReportAction(slug, formData);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="report-layout">
      <section className="card">
        <p className="eyebrow">End-of-day field report</p>
        <h1>{project.name}</h1>
        <p className="subtitle">
          This report is evidence. It records whether the whiteboard plan worked, what failed, and what must change tomorrow.
        </p>
      </section>

      <form action={submitReport} className="form-grid">
        <section className="card form-grid">
          <div className="columns">
            <label><span className="eyebrow">Date</span><input className="input" type="date" name="reportDate" required defaultValue={today} /></label>
            <label><span className="eyebrow">Submitted by</span><input className="input" name="submittedBy" required placeholder="Field lead" /></label>
          </div>
          <label><span className="eyebrow">Crew members</span><input className="input" name="crewMembers" placeholder="Cody, Matt, Luis" /></label>
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Morning Board</p>
              <h2>Planned tasks referenced by this report</h2>
            </div>
          </div>
          <div className="list">
            {boardTasks.map((task) => (
              <div key={task.id} className="task-report-row">
                <label className="mini-check"><input type="checkbox" name="plannedTaskIds" value={task.id} /> Planned</label>
                <div><strong>{task.taskName}</strong><br /><span className="muted">{task.area} · {task.phaseCode}</span></div>
                <label className="mini-check"><input type="checkbox" name="completedTaskIds" value={task.id} /> Complete</label>
                <label className="mini-check"><input type="checkbox" name="incompleteTaskIds" value={task.id} /> Incomplete</label>
              </div>
            ))}
          </div>
        </section>

        <section className="card form-grid">
          <p className="eyebrow">Reality</p>
          <LaborLogEditor phaseCodes={phaseCodes} />
          <label><span className="eyebrow">Blockers</span><textarea className="textarea" name="blockers" placeholder="One blocker per line" /></label>
          <label><span className="eyebrow">Tomorrow recommendations</span><textarea className="textarea" name="tomorrowRecommendations" /></label>
        </section>

        <section className="card form-grid variance-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Variance Log</p>
              <h2>Highest priority</h2>
            </div>
            <span className="badge high">Global rules apply</span>
          </div>
          <div className="columns">
            <label>
              <span className="eyebrow">Variance type</span>
              <select className="select" name="varianceType" defaultValue="schedule">
                {varianceTypes.map((type) => <option key={type} value={type}>{type.replace("_", " ")}</option>)}
              </select>
            </label>
            <label><span className="eyebrow">Affected area</span><input className="input" name="affectedArea" /></label>
          </div>
          <label><span className="eyebrow">Description</span><textarea className="textarea" name="varianceDescription" /></label>
          <div className="columns">
            <label><span className="eyebrow">Discovered by</span><input className="input" name="discoveredBy" /></label>
            <label><span className="eyebrow">Discovered date/time</span><input className="input" type="datetime-local" name="discoveredAt" /></label>
          </div>
          <div className="columns">
            <label>
              <span className="eyebrow">Requires change order</span>
              <select className="select" name="requiresChangeOrder" defaultValue="unknown">
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>
          <div className="ops-stats">
            <label><span className="eyebrow">Labor impact hours</span><input className="input" type="number" step="0.25" name="laborImpactHours" /></label>
            <label><span className="eyebrow">Material impact</span><input className="input" name="materialImpact" /></label>
            <label><span className="eyebrow">Schedule impact days</span><input className="input" type="number" step="1" name="scheduleImpactDays" /></label>
          </div>
          <label className="check-row"><input type="checkbox" name="clientNotified" /> <span>Client notified</span></label>
          <label><span className="eyebrow">Internal notes</span><textarea className="textarea" name="internalNotes" /></label>
          <div className="list">
            {globalChangeOrderRules.slice(0, 3).map((rule) => (
              <div className="list-item" key={rule.trigger}>
                <strong>{rule.trigger}</strong>
                <p className="muted">{rule.enforcement}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card form-grid">
          <p className="eyebrow">Proof Photos</p>
          <input className="input" type="file" name="photos" multiple accept={photoAccept} />
          <label><span className="eyebrow">Photo captions</span><textarea className="textarea" name="photoCaptions" placeholder="One caption per photo" /></label>
        </section>

        <button className="button submit-bar" type="submit">Submit field report</button>
      </form>
    </div>
  );
}
