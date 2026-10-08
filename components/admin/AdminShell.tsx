"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { navItems } from "./admin-data";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="admin-shell">
    <aside className={`admin-sidebar ${open ? "is-open" : ""}`}>
      <div className="admin-brand"><div className="admin-logo">✦</div><div><strong>Avatar Studio</strong><span>Admin workspace</span></div></div>
      <nav className="admin-nav"><p className="admin-nav-label">Workspace</p>{navItems.slice(0, 4).map(([label, href, icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={pathname === href ? "is-active" : ""}><i>{icon}</i>{label}{label === "Create Avatar" && <b>New</b>}</Link>)}<p className="admin-nav-label admin-nav-label-spaced">Manage</p>{navItems.slice(4).map(([label, href, icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={pathname === href ? "is-active" : ""}><i>{icon}</i>{label}</Link>)}</nav>
      <div className="admin-sidebar-bottom"><div className="admin-help"><span>?</span><div><strong>Need help?</strong><small>Read the admin guide</small></div></div><div className="admin-profile"><div className="admin-avatar-circle">JD</div><div><strong>Jordan Davis</strong><small>Administrator</small></div><span>•••</span></div></div>
    </aside>
    {open && <button className="admin-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <main className="admin-main"><header className="admin-header"><button className="admin-menu-button" onClick={() => setOpen(!open)} aria-label="Open navigation">☰</button><div className="admin-search"><span>⌕</span><input placeholder="Search avatars, voices, settings..." /></div><div className="admin-header-actions"><span className="environment-pill"><i /> Production</span><button className="icon-button" aria-label="Notifications">♧<em>3</em></button><div className="header-user"><div className="admin-avatar-circle small">JD</div><span>Jordan Davis</span><b>⌄</b></div></div></header><div className="admin-content">{children}</div></main>
  </div>;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) { return <div className="admin-page-heading"><div>{eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>; }

export function StatusBadge({ status }: { status: string }) { return <span className={`status-badge ${status.toLowerCase()}`}><i />{status}</span>; }

export function AvatarThumb({ avatar, large = false }: { avatar: { name: string; color: string }; large?: boolean }) { return <div className={`avatar-thumb ${large ? "large" : ""}`} style={{ background: `linear-gradient(145deg, ${avatar.color}, #151a2d)` }}><span>{avatar.name.split(" ").map((n) => n[0]).join("")}</span><div className="avatar-glow" /></div>; }
