import Link from "next/link";
import { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/historical", label: "Historical Explorer" },
  { href: "/tournament-2026", label: "2026 Hub" },
  { href: "/signal-bracket", label: "Signal Bracket" },
  { href: "/upset-lab", label: "Upset Lab" },
  { href: "/bracket", label: "Bracket Builder" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-header__brand">
          <p className="site-header__eyebrow">Bracket Signal</p>
          <Link href="/" className="site-header__title">
            NCAA Tournament Signal Board
          </Link>
        </div>
        <nav className="site-nav" aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="site-nav__link">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="page-shell">
        <section className="page-hero">
          {eyebrow ? <p className="page-hero__eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
        </section>
        {children}
      </main>
    </div>
  );
}
