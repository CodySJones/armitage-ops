export const inlineGlobalStyles = `
:root {
  --bg: #f3efe7;
  --bg-accent: #e6dfd0;
  --surface: rgba(255, 252, 246, 0.88);
  --surface-strong: #fffaf2;
  --ink: #1f1c19;
  --muted: #6b6258;
  --line: rgba(73, 60, 45, 0.14);
  --brand: #8e5d31;
  --brand-dark: #5f3c1f;
  --danger: #8a2d24;
  --warning: #a56810;
  --success: #2f6a49;
  --radius-lg: 28px;
  --radius-md: 18px;
  --shadow: 0 18px 50px rgba(68, 48, 24, 0.10);
}

* {
  box-sizing: border-box;
}

html {
  font-size: 16px;
}

body {
  margin: 0;
  color: var(--ink);
  background:
    radial-gradient(circle at top left, rgba(201, 160, 103, 0.22), transparent 28%),
    radial-gradient(circle at right 20%, rgba(96, 60, 31, 0.12), transparent 24%),
    linear-gradient(180deg, #f8f4ed 0%, #efe7da 100%);
  font-family: Georgia, "Times New Roman", serif;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select,
textarea {
  font: inherit;
}

.shell {
  min-height: 100vh;
  padding: 24px;
}

.frame {
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}

.brand {
  display: grid;
  gap: 4px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.72rem;
  color: var(--muted);
}

.title {
  font-size: clamp(2rem, 4vw, 3.6rem);
  line-height: 0.95;
  margin: 0;
}

.subtitle {
  color: var(--muted);
  margin: 0;
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.pill {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 250, 242, 0.76);
}

.grid {
  display: grid;
  gap: 20px;
}

.grid.dashboard {
  grid-template-columns: 1.5fr 1fr;
}

.card {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}

.card h2,
.card h3,
.card h4,
.card p {
  margin-top: 0;
}

.hero {
  display: grid;
  gap: 14px;
  align-items: start;
}

.hero-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.stat {
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--surface-strong);
  border: 1px solid var(--line);
}

.stat-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
}

.stat-value {
  font-size: 2rem;
  margin-top: 6px;
}

.list {
  display: grid;
  gap: 12px;
}

.list-item {
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: rgba(255, 249, 241, 0.9);
}

.list-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.muted {
  color: var(--muted);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 8px 12px;
  background: #f3eadb;
  border: 1px solid var(--line);
  font-size: 0.85rem;
}

.badge.high,
.badge.critical {
  background: rgba(138, 45, 36, 0.12);
  color: var(--danger);
}

.badge.medium {
  background: rgba(165, 104, 16, 0.13);
  color: var(--warning);
}

.badge.low,
.badge.ready {
  background: rgba(47, 106, 73, 0.12);
  color: var(--success);
}

.columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.form-grid {
  display: grid;
  gap: 14px;
}

.input,
.textarea,
.select {
  width: 100%;
  border: 1px solid var(--line);
  background: var(--surface-strong);
  border-radius: 16px;
  padding: 14px 16px;
}

.textarea {
  min-height: 96px;
  resize: vertical;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.button {
  border: 0;
  border-radius: 999px;
  padding: 13px 18px;
  background: var(--brand-dark);
  color: white;
  cursor: pointer;
}

.button.secondary {
  background: #e9dcc7;
  color: var(--ink);
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}

.kicker {
  color: var(--brand-dark);
  font-style: italic;
}

.dropzone {
  width: 100%;
  border: 2px dashed rgba(95, 60, 31, 0.3);
  background: linear-gradient(180deg, rgba(255, 250, 242, 0.96), rgba(239, 231, 218, 0.96));
  border-radius: 22px;
  padding: 28px 20px;
  text-align: center;
  cursor: pointer;
  transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
}

.dropzone:hover,
.dropzone.dragging {
  transform: translateY(-1px);
  border-color: var(--brand);
  background: linear-gradient(180deg, rgba(247, 238, 223, 1), rgba(237, 224, 200, 1));
}

.dropzone-copy {
  display: grid;
  gap: 8px;
  justify-items: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1024px) {
  .grid.dashboard,
  .hero-grid,
  .columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .shell {
    padding: 14px;
  }

  .topbar,
  .card {
    padding: 18px;
  }
}
`;
