import type { ReactNode } from "react";

interface PagePanelProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export default function PagePanel({ eyebrow, title, description, children }: PagePanelProps) {
  return (
    <div className="flex flex-col gap-3 py-3">
      <section className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        {eyebrow && (
          <p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--foreground)]">{title}</h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
        )}
      </section>

      {children}
    </div>
  );
}
