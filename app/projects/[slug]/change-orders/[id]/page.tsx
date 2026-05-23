import Link from "next/link";
import { notFound } from "next/navigation";
import { getChangeOrder, getFieldReport, getOpsProject } from "@/lib/ops-store";

type ChangeOrderPageProps = {
  params: Promise<{ slug: string; id: string }>;
};

export default async function ChangeOrderPage({ params }: ChangeOrderPageProps) {
  const { slug, id } = await params;
  const project = await getOpsProject(slug);
  const draft = await getChangeOrder(slug, id);
  const report = draft ? await getFieldReport(slug, draft.fieldReportId) : null;

  if (!project || !draft || !report) {
    notFound();
  }

  const variance = report.variances.find((candidate) => candidate.id === draft.varianceId);

  return (
    <div className="report-layout">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Change Order Draft</p>
            <h1>{draft.title}</h1>
          </div>
          <span className="badge high">PM review required</span>
        </div>
        <p className="subtitle">
          Drafts are generated from field-report variance evidence. They are never sent automatically.
        </p>
      </section>

      <section className="card">
        <p className="eyebrow">AI Summary Placeholder</p>
        <h2>Issue summary</h2>
        <p>{draft.aiSummary}</p>
      </section>

      <section className="columns">
        <div className="card">
          <p className="eyebrow">Estimated Impact</p>
          <div className="ops-stats single-column">
            <div className="stat"><div className="stat-label">Labor</div><div className="stat-value">{draft.estimatedLaborHours}h</div></div>
            <div className="stat"><div className="stat-label">Materials</div><div className="stat-value">${draft.estimatedMaterialDollars}</div></div>
            <div className="stat"><div className="stat-label">Schedule</div><div className="stat-value">{draft.estimatedScheduleDays} day(s)</div></div>
          </div>
        </div>
        <div className="card">
          <p className="eyebrow">Source Evidence</p>
          <h2>Variance details</h2>
          {variance ? (
            <>
              <p>{variance.description}</p>
              <p className="muted">{variance.internalNotes}</p>
              <p className="muted">Client notified: {variance.clientNotified ? "yes" : "no"}</p>
            </>
          ) : <p className="muted">Variance not found.</p>}
          <Link className="button secondary" href={`/projects/${project.id}/reports/${report.id}`}>Open source report</Link>
        </div>
      </section>
    </div>
  );
}
