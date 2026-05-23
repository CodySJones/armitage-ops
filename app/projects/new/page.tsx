import Link from "next/link";
import { createProjectAction } from "@/lib/ops-store";
import { globalChangeOrderRules } from "@/lib/global-rules";

export default function NewProjectPage() {
  return (
    <div className="report-layout">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Project Onboarding</p>
            <h1>Create the operating record</h1>
          </div>
          <span className="badge ready">Step 1 of 3</span>
        </div>
        <p className="subtitle">
          Start with the job identity and team. Schedule import comes next; change-order rules are global company policy.
        </p>
      </section>

      <section className="columns">
        <form action={createProjectAction} className="card form-grid">
          <div className="columns">
            <label><span className="eyebrow">Project name</span><input className="input" name="name" required /></label>
            <label><span className="eyebrow">Client</span><input className="input" name="clientName" required /></label>
          </div>
          <label><span className="eyebrow">Address / scope area</span><input className="input" name="address" /></label>
          <div className="columns">
            <label><span className="eyebrow">Project manager</span><input className="input" name="projectManager" /></label>
            <label><span className="eyebrow">Field lead</span><input className="input" name="fieldLead" /></label>
          </div>
          <label><span className="eyebrow">Current phase</span><input className="input" name="currentPhase" placeholder="Demo, rough MEP, tile, cabinets" /></label>
          <div className="columns">
            <label><span className="eyebrow">Planned start</span><input className="input" type="date" name="plannedStartDate" /></label>
            <label><span className="eyebrow">Planned end</span><input className="input" type="date" name="plannedEndDate" /></label>
          </div>
          <div className="button-row">
            <button className="button" type="submit">Continue to schedule</button>
            <Link className="button secondary" href="/projects">Cancel</Link>
          </div>
        </form>

        <aside className="card">
          <p className="eyebrow">Global Enforcement</p>
          <h2>Rules are automatic</h2>
          <div className="list">
            {globalChangeOrderRules.slice(0, 5).map((rule) => (
              <div className="list-item" key={rule.trigger}>
                <strong>{rule.trigger}</strong>
                <p className="muted">{rule.enforcement}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
