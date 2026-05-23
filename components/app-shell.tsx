import Link from "next/link";
import type { Route } from "next";

const navItems = [
  { href: "/" as Route, label: "Ops Dashboard" },
  { href: "/projects" as Route, label: "Projects" },
  { href: "/projects/new" as Route, label: "New Project", className: "desktop-only" },
  { href: "/login" as Route, label: "Login" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell">
      <div className="frame">
        <header className="topbar">
          <div className="brand">
            <span className="eyebrow">Armitage Interiors</span>
            <strong>Operations control system</strong>
          </div>
          <nav className="nav">
            {navItems.map((item) => (
              <Link key={item.href} className={`pill ${item.className || ""}`.trim()} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
