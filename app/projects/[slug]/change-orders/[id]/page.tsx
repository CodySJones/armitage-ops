import Link from "next/link";
import { notFound } from "next/navigation";
import { getChangeOrder, getFieldReport, getOpsProject, updateChangeOrderAction } from "@/lib/ops-store";
import { PrintButton } from "@/components/print-button";

type ChangeOrderPageProps = {
  params: Promise<{ slug: string; id: string }>;
};

const STATUS_BADGE: Record<string, string> = {
  pm_review_required: "badge high",
  approved: "badge ready",
  rejected: "badge",
};

const STATUS_LABEL: Record<string, string> = {
  pm_review_required: "PM review required",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function ChangeOrderPage({ params }: ChangeOrderPageProps) {
  const { slug, id } = await params;
  const project = await getOpsProject(slug);
  const draft = await getChangeOrder(slug, id);
  const report = draft ? await getFieldReport(slug, draft.fieldReportId) : null;

  if (!project || !draft || !report) {
    notFound();
  }

  const variance = report.variances.find((v) => v.id === draft.varianceId);
  const laborCost = draft.estimatedLaborHours * draft.laborRateDollars;
  const total = laborCost + draft.estimatedMaterialDollars;
  const isApproved = draft.reviewStatus === "approved";
  const isRejected = draft.reviewStatus === "rejected";
  const coLabel = draft.coNumber || `CO-${draft.id.slice(-4).toUpperCase()}`;

  const updateAction = updateChangeOrderAction.bind(null, id);

  return (
    <>
      {/* ── Print-only document ─────────────────────────────────────── */}
      <div className="co-print-doc">
        <div className="co-print-header">
          <div>
            <div className="co-print-company">ARMITAGE INTERIORS</div>
            <div className="co-print-sub">Field Change Order</div>
          </div>
          <div className="co-print-meta-right">
            <div><strong>CO#:</strong> {coLabel}</div>
            <div><strong>Date:</strong> {new Date(draft.createdAt).toLocaleDateString()}</div>
            <div><strong>Status:</strong> {STATUS_LABEL[draft.reviewStatus] ?? draft.reviewStatus}</div>
          </div>
        </div>

        <table className="co-print-info">
          <tbody>
            <tr>
              <td><strong>Project</strong></td><td>{project.name}</td>
              <td><strong>Client</strong></td><td>{project.clientName}</td>
            </tr>
            <tr>
              <td><strong>Address</strong></td><td>{project.address}</td>
              <td><strong>PM</strong></td><td>{project.projectManager || "—"}</td>
            </tr>
          </tbody>
        </table>

        <div className="co-print-section">
          <div className="co-print-label">Description of Change</div>
          <div className="co-print-body">{draft.aiSummary}</div>
        </div>

        <div className="co-print-section">
          <div className="co-print-label">Cost Breakdown</div>
          <table className="co-cost-table">
            <tbody>
              {draft.laborRateDollars > 0 ? (
                <tr>
                  <td>Labor</td>
                  <td>{draft.estimatedLaborHours} hrs × ${draft.laborRateDollars}/hr</td>
                  <td className="co-cost-amount">${laborCost.toFixed(2)}</td>
                </tr>
              ) : (
                <tr>
                  <td>Labor</td>
                  <td>{draft.estimatedLaborHours} hrs (rate TBD)</td>
                  <td className="co-cost-amount">—</td>
                </tr>
              )}
              <tr>
                <td>Materials</td>
                <td></td>
                <td className="co-cost-amount">${draft.estimatedMaterialDollars.toFixed(2)}</td>
              </tr>
              <tr className="co-cost-total">
                <td colSpan={2}><strong>Total Change Order Amount</strong></td>
                <td className="co-cost-amount">
                  <strong>{draft.laborRateDollars > 0 ? `$${total.toFixed(2)}` : "Pending labor rate"}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="co-print-section">
          <div className="co-print-label">Schedule Impact</div>
          <div className="co-print-body">
            {draft.estimatedScheduleDays > 0
              ? `${draft.estimatedScheduleDays} calendar day(s) added to project timeline.`
              : "No schedule impact."}
          </div>
        </div>

        <div className="co-print-section co-print-notice">
          This change order modifies the original contract scope and price. Work may not proceed until
          both parties have signed. All other contract terms remain in effect.
        </div>

        <div className="co-sig-block">
          <div className="co-sig-line">
            <div className="co-sig-field"></div>
            <div className="co-sig-caption">Project Manager — Date</div>
          </div>
          <div className="co-sig-line">
            <div className="co-sig-field"></div>
            <div className="co-sig-caption">Client Signature — Date</div>
          </div>
        </div>

        {isApproved && draft.approvedBy && (
          <div className="co-print-approved">
            Approved by {draft.approvedBy} on {new Date(draft.approvedAt!).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* ── Screen UI ───────────────────────────────────────────────── */}
      <div className="report-layout co-screen">
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Change Order Draft · {coLabel}</p>
              <h1>{draft.title}</h1>
            </div>
            <div className="button-row">
              <span className={STATUS_BADGE[draft.reviewStatus] ?? "badge"}>
                {STATUS_LABEL[draft.reviewStatus] ?? draft.reviewStatus}
              </span>
              <PrintButton />
            </div>
          </div>
          <p className="subtitle">
            Generated from field report dated {report.reportDate} · submitted by {report.submittedBy}
          </p>
        </section>

        {/* Source evidence */}
        {variance && (
          <section className="card">
            <p className="eyebrow">Source Evidence</p>
            <h2>Variance — {variance.type.replace(/_/g, " ")}</h2>
            <p>{variance.description}</p>
            <div className="button-row" style={{ marginTop: "12px" }}>
              <Link className="button secondary" href={`/projects/${slug}/reports/${report.id}`}>
                Open source report
              </Link>
            </div>
          </section>
        )}

        {/* PM edit form */}
        {!isApproved && !isRejected && (
          <section className="card form-grid">
            <p className="eyebrow">PM Review</p>
            <h2>Confirm impact and approve</h2>
            <form action={updateAction} className="form-grid">
              <div className="columns">
                <label>
                  <span className="eyebrow">CO number</span>
                  <input className="input" name="coNumber" defaultValue={draft.coNumber} placeholder="CO-001" />
                </label>
                <label>
                  <span className="eyebrow">Title</span>
                  <input className="input" name="title" defaultValue={draft.title} required />
                </label>
              </div>
              <label>
                <span className="eyebrow">Description</span>
                <textarea className="textarea" name="description" defaultValue={draft.aiSummary} />
              </label>
              <div className="columns" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                <label>
                  <span className="eyebrow">Labor hours</span>
                  <input className="input" type="number" step="0.25" min="0" name="laborHours"
                    defaultValue={draft.estimatedLaborHours || ""} placeholder="0" />
                </label>
                <label>
                  <span className="eyebrow">Labor rate ($/hr)</span>
                  <input className="input" type="number" step="1" min="0" name="laborRate"
                    defaultValue={draft.laborRateDollars || ""} placeholder="e.g. 85" />
                </label>
                <label>
                  <span className="eyebrow">Material cost ($)</span>
                  <input className="input" type="number" step="1" min="0" name="materialDollars"
                    defaultValue={draft.estimatedMaterialDollars || ""} placeholder="0" />
                </label>
              </div>
              <div className="columns">
                <label>
                  <span className="eyebrow">Schedule days</span>
                  <input className="input" type="number" step="1" min="0" name="scheduleDays"
                    defaultValue={draft.estimatedScheduleDays || ""} placeholder="0" />
                </label>
                <label>
                  <span className="eyebrow">Approved by (your name)</span>
                  <input className="input" name="approvedBy" placeholder="Name" />
                </label>
              </div>

              {/* Totals preview */}
              {(draft.estimatedLaborHours > 0 || draft.estimatedMaterialDollars > 0) && (
                <div className="ops-stats" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                  <div className="stat">
                    <div className="stat-label">Labor cost</div>
                    <div className="stat-value">
                      {draft.laborRateDollars > 0 ? `$${laborCost.toFixed(0)}` : `${draft.estimatedLaborHours}h`}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Materials</div>
                    <div className="stat-value">${draft.estimatedMaterialDollars.toFixed(0)}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Schedule</div>
                    <div className="stat-value">{draft.estimatedScheduleDays}d</div>
                  </div>
                </div>
              )}

              <div className="button-row">
                <button type="submit" name="_action" value="save" className="button secondary">Save draft</button>
                <button type="submit" name="_action" value="approve" className="button">Approve — ready for client</button>
                <button type="submit" name="_action" value="reject" className="button secondary">Reject</button>
              </div>
            </form>
          </section>
        )}

        {/* Approved state */}
        {isApproved && (
          <section className="card">
            <p className="eyebrow">Status</p>
            <h2>Approved</h2>
            <p>Approved by {draft.approvedBy} on {draft.approvedAt ? new Date(draft.approvedAt).toLocaleDateString() : "—"}.</p>
            <p className="muted">Use the Print / Save PDF button above to generate the client copy.</p>
          </section>
        )}

        {/* Rejected state */}
        {isRejected && (
          <section className="card">
            <p className="eyebrow">Status</p>
            <h2>Rejected</h2>
            <p className="muted">This draft was rejected. No CO will be issued for this variance.</p>
            <form action={updateAction} style={{ marginTop: "12px" }}>
              <input type="hidden" name="_action" value="save" />
              <input type="hidden" name="coNumber" value={draft.coNumber} />
              <input type="hidden" name="title" value={draft.title} />
              <input type="hidden" name="description" value={draft.aiSummary} />
              <input type="hidden" name="laborHours" value={draft.estimatedLaborHours} />
              <input type="hidden" name="laborRate" value={draft.laborRateDollars} />
              <input type="hidden" name="materialDollars" value={draft.estimatedMaterialDollars} />
              <input type="hidden" name="scheduleDays" value={draft.estimatedScheduleDays} />
              <button type="submit" className="button secondary">Reopen for review</button>
            </form>
          </section>
        )}

        <div className="button-row">
          <Link className="button secondary" href={`/projects/${slug}`}>Back to project</Link>
        </div>
      </div>

      <style>{`
        /* ── Print document styles ─────────────────────────── */
        .co-print-doc {
          display: none;
        }

        @media print {
          .co-screen { display: none !important; }
          .co-print-doc {
            display: block;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            color: #000;
            padding: 0.5in;
            max-width: 100%;
          }
          .co-print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000;
            padding-bottom: 12pt;
            margin-bottom: 14pt;
          }
          .co-print-company {
            font-size: 18pt;
            font-weight: bold;
            letter-spacing: 0.05em;
          }
          .co-print-sub {
            font-size: 11pt;
            color: #444;
            margin-top: 2pt;
          }
          .co-print-meta-right {
            text-align: right;
            font-size: 10pt;
            line-height: 1.7;
          }
          .co-print-info {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16pt;
            font-size: 10pt;
          }
          .co-print-info td {
            padding: 4pt 8pt 4pt 0;
            width: 25%;
          }
          .co-print-section {
            margin-bottom: 16pt;
          }
          .co-print-label {
            font-size: 8pt;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #555;
            margin-bottom: 4pt;
            border-bottom: 1px solid #ccc;
            padding-bottom: 3pt;
          }
          .co-print-body {
            font-size: 10.5pt;
            line-height: 1.5;
          }
          .co-cost-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5pt;
          }
          .co-cost-table td {
            padding: 5pt 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .co-cost-amount {
            text-align: right;
            min-width: 80pt;
          }
          .co-cost-total td {
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 6pt 0;
          }
          .co-print-notice {
            font-size: 9pt;
            color: #555;
            font-style: italic;
            border: 1px solid #ccc;
            padding: 8pt;
          }
          .co-sig-block {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30pt;
            margin-top: 30pt;
          }
          .co-sig-field {
            border-bottom: 1px solid #000;
            height: 28pt;
            margin-bottom: 4pt;
          }
          .co-sig-caption {
            font-size: 9pt;
            color: #555;
          }
          .co-print-approved {
            margin-top: 16pt;
            font-size: 9pt;
            color: #226644;
          }
        }
      `}</style>
    </>
  );
}
