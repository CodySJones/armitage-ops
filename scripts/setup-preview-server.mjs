import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const port = Number.parseInt(process.env.PORT || "3001", 10);
const root = process.cwd();

async function readProjects() {
  try {
    const raw = await readFile(path.join(root, "storage", "projects.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setupStatus(project) {
  if (!project.contract) {
    return ["Contract needed", "Upload the contract PDF and first payment milestone before schedule setup continues."];
  }

  if (!project.schedule) {
    return ["Schedule needed", "Upload the baseline schedule so Baseline can start measuring drift."];
  }

  return ["Ready for control data", "Contract and schedule are saved. Add live control data or open the project."];
}

function render(projects) {
  const projectRows = projects.length
    ? projects
        .map((project) => {
          const [label, detail] = setupStatus(project);
          return `
            <div class="list-item">
              <div class="list-row">
                <div>
                  <strong>${escapeHtml(project.name)}</strong>
                  <p class="muted">${escapeHtml(detail)}</p>
                </div>
                <span class="badge">${escapeHtml(label)}</span>
              </div>
            </div>`;
        })
        .join("")
    : `<p class="muted">No projects are saved yet. Use the new job form to create the first one.</p>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Baseline Setup Preview</title>
    <style>
      :root {
        --surface: rgba(255, 252, 246, 0.9);
        --surface-strong: #fffaf2;
        --ink: #1f1c19;
        --muted: #6b6258;
        --line: rgba(73, 60, 45, 0.14);
        --brand-dark: #5f3c1f;
        --success: #2f6a49;
        --radius-lg: 28px;
        --radius-md: 18px;
        --shadow: 0 18px 50px rgba(68, 48, 24, 0.10);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(201, 160, 103, 0.22), transparent 28%),
          linear-gradient(180deg, #f8f4ed 0%, #efe7da 100%);
        font-family: Georgia, "Times New Roman", serif;
      }
      .shell { min-height: 100vh; padding: 24px; }
      .frame { max-width: 1280px; margin: 0 auto; display: grid; gap: 20px; }
      .topbar, .card {
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: var(--surface);
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }
      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px;
      }
      .card { padding: 22px; }
      .grid { display: grid; gap: 20px; }
      .setup-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.7fr); gap: 20px; }
      .section-heading, .list-row { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.72rem;
        color: var(--muted);
      }
      .title { font-size: clamp(2rem, 4vw, 3.6rem); line-height: 0.95; margin: 0; }
      .subtitle, .muted { color: var(--muted); }
      .form-grid, .list, .setup-steps { display: grid; gap: 14px; }
      .columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
      .input, .textarea {
        width: 100%;
        border: 1px solid var(--line);
        background: var(--surface-strong);
        border-radius: 16px;
        padding: 14px 16px;
        font: inherit;
      }
      .textarea { min-height: 96px; resize: vertical; }
      .button-row { display: flex; flex-wrap: wrap; gap: 12px; }
      .button {
        border: 0;
        border-radius: 999px;
        padding: 13px 18px;
        background: var(--brand-dark);
        color: white;
      }
      .button.secondary { background: #e9dcc7; color: var(--ink); }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 8px 12px;
        background: rgba(47, 106, 73, 0.12);
        color: var(--success);
        border: 1px solid var(--line);
        font-size: 0.85rem;
      }
      .list-item, .step-item {
        padding: 14px 16px;
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        background: rgba(255, 249, 241, 0.9);
      }
      .step-item { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; }
      .file-field {
        display: grid;
        gap: 10px;
        padding: 16px;
        border: 1px dashed rgba(95, 60, 31, 0.28);
        border-radius: var(--radius-md);
        background: rgba(255, 249, 241, 0.68);
      }
      @media (max-width: 1024px) { .setup-grid, .columns { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="shell">
      <div class="frame">
        <header class="topbar">
          <div>
            <span class="eyebrow">Baseline</span><br />
            <strong>Internal project control for remodeling jobs</strong>
          </div>
          <span class="badge">Preview server on localhost:${port}</span>
        </header>

        <section class="card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Setup Wrapper</p>
              <h1 class="title">Load the right files and get a job into Baseline.</h1>
            </div>
            <span class="badge">Contract first</span>
          </div>
          <p class="subtitle">Start with the signed contract, then attach the baseline schedule. After that, the project is ready for control data, field reports, and schedule-risk checks.</p>
        </section>

        <section class="setup-grid">
          <div class="card">
            <div class="section-heading">
              <div>
                <p class="eyebrow">New Job</p>
                <h2>Create project and upload contract</h2>
              </div>
              <span class="badge">Step 1</span>
            </div>
            <div class="form-grid">
              <label><div class="eyebrow">Project name</div><input class="input" placeholder="Riegel Kitchen and Powder Room" /></label>
              <div class="columns">
                <label><div class="eyebrow">Internal code</div><input class="input" placeholder="RKP-2026-004" /></label>
                <label><div class="eyebrow">Client name</div><input class="input" placeholder="Ilene Riegel" /></label>
              </div>
              <label><div class="eyebrow">Address</div><input class="input" placeholder="23 Mystic View Lane, Doylestown, PA" /></label>
              <label class="file-field"><div><div class="eyebrow">Signed contract PDF</div><p class="muted">This creates the project and sends you straight to schedule upload.</p></div><input class="input" type="file" accept="application/pdf" /></label>
              <div class="columns">
                <label><div class="eyebrow">Next payment milestone</div><input class="input" placeholder="Start of flooring" /></label>
                <label><div class="eyebrow">Amount</div><input class="input" placeholder="$23,654.45" /></label>
              </div>
              <label><div class="eyebrow">Trigger condition summary</div><textarea class="textarea" placeholder="Flooring install complete, pictures uploaded, inspection blockers closed."></textarea></label>
              <div class="button-row"><button class="button">Create and continue</button><button class="button secondary">View projects</button></div>
            </div>
          </div>

          <aside class="card">
            <p class="eyebrow">Click Through</p>
            <h2>Setup path</h2>
            <div class="setup-steps">
              <div class="step-item"><span class="badge">1</span><div><strong>Upload signed contract</strong><p class="muted">Creates the job record and captures the first payment trigger.</p></div></div>
              <div class="step-item"><span class="badge">2</span><div><strong>Upload baseline schedule</strong><p class="muted">Attach the ProjectLibre, Materio, or PDF schedule export for revision 1.</p></div></div>
              <div class="step-item"><span class="badge">3</span><div><strong>Add control data</strong><p class="muted">Set phase, crew, payment date, and variance for the owner board.</p></div></div>
              <div class="step-item"><span class="badge">4</span><div><strong>Start field reporting</strong><p class="muted">Daily reports become the reality check against the schedule.</p></div></div>
            </div>
          </aside>
        </section>

        <section class="card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Existing Jobs</p>
              <h2>Continue setup where each project left off</h2>
            </div>
          </div>
          <div class="list">${projectRows}</div>
        </section>
      </div>
    </main>
  </body>
</html>`;
}

const server = createServer(async (_request, response) => {
  const projects = await readProjects();
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(render(projects));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Baseline setup preview ready: http://localhost:${port}/setup`);
});
