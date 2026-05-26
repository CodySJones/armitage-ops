import { notFound } from "next/navigation";
import { createFieldReportAction, getOpsProject } from "@/lib/ops-store";
import { photoAccept } from "@/lib/upload-accept";
import { LaborLogEditor } from "@/components/labor-log-editor";

type NewFieldReportPageProps = {
  params: Promise<{ slug: string }>;
};

const phaseCodes = ["DEMO", "FRAMING", "ROUGH_MEP", "INSULATION", "DRYWALL", "TILE", "CABINETRY", "FINISH", "PUNCH"];
const varianceTypes = ["scope", "schedule", "labor", "cost", "quality", "legal", "hidden_condition", "client_request", "client_decision"];

export default async function NewFieldReportPage({ params }: NewFieldReportPageProps) {
  const { slug } = await params;
  const project = await getOpsProject(slug);

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
        <p className="eyebrow">End-of-day report</p>
        <h1>{project.name}</h1>
        <p className="subtitle">Log what happened today. Takes 5 minutes.</p>
      </section>

      <form action={submitReport} className="form-grid">
        <section className="card form-grid">
          <div className="columns">
            <label>
              <span className="eyebrow">Date</span>
              <input className="input" type="date" name="reportDate" required defaultValue={today} />
            </label>
            <label>
              <span className="eyebrow">Submitted by</span>
              <input className="input" name="submittedBy" required placeholder="Your name" />
            </label>
          </div>
          <label>
            <span className="eyebrow">Crew on site</span>
            <input className="input" name="crewMembers" placeholder="Matt, Luis, Cody" />
          </label>
        </section>

        <section className="card">
          <LaborLogEditor phaseCodes={phaseCodes} />
        </section>

        <section className="card form-grid">
          <label>
            <span className="eyebrow">Blockers</span>
            <textarea className="textarea" name="blockers" placeholder="One per line — anything stopping tomorrow's work" />
          </label>
          <label>
            <span className="eyebrow">Tomorrow's plan</span>
            <textarea className="textarea" name="tomorrowRecommendations" placeholder="What's happening tomorrow?" />
          </label>
        </section>

        <section className="card form-grid">
          <p className="eyebrow">Photos</p>
          <input className="input" type="file" name="photos" multiple accept={photoAccept} />
          <label>
            <span className="eyebrow">Captions</span>
            <textarea className="textarea" name="photoCaptions" placeholder="One caption per photo, one per line" />
          </label>
        </section>

        <section className="card form-grid">
          <div>
            <p className="eyebrow">Variance</p>
            <h2>Notable issue?</h2>
            <p className="muted">Only fill this in if something happened that affects scope, schedule, or cost. PM reviews before any client communication.</p>
          </div>
          <label>
            <span className="eyebrow">What happened</span>
            <textarea
              className="textarea"
              name="varianceDescription"
              placeholder="Describe the issue — what was found, where, and when"
            />
          </label>
          <div className="columns">
            <label>
              <span className="eyebrow">Type</span>
              <select className="select" name="varianceType" defaultValue="schedule">
                {varianceTypes.map((type) => (
                  <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="eyebrow">Change order?</span>
              <select className="select" name="requiresChangeOrder" defaultValue="unknown">
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>
          <div className="columns">
            <label>
              <span className="eyebrow">Labor hours</span>
              <input className="input" type="number" step="0.25" min="0" name="laborImpactHours" placeholder="0" />
            </label>
            <label>
              <span className="eyebrow">Material cost ($)</span>
              <input className="input" type="number" step="1" min="0" name="materialImpact" placeholder="0" />
            </label>
            <label>
              <span className="eyebrow">Schedule days</span>
              <input className="input" type="number" step="1" min="0" name="scheduleImpactDays" placeholder="0" />
            </label>
          </div>
        </section>

        <button className="button submit-bar" type="submit">Submit report</button>
      </form>
    </div>
  );
}
