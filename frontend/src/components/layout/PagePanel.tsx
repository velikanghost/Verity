import type { ReactNode } from "react"

interface PagePanelProps {
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
}

export default function PagePanel({
  eyebrow,
  title,
  description,
  children,
}: PagePanelProps) {
  return (
    <div className="flex flex-col gap-3 py-3 sm:py-4">
      <section className="verity-card relative overflow-hidden p-4 sm:p-5">
        <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-sunburst-yellow/30" />
        {eyebrow && (
          <p className="relative font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ember-orange">
            {eyebrow}
          </p>
        )}
        <h1 className="relative mt-1 text-[30px] font-semibold leading-[1.08] tracking-[-0.7px] text-midnight sm:text-[34px] sm:tracking-[-0.9px]">
          {title}
        </h1>
        {description && (
          <p className="relative mt-2 max-w-[520px] text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
            {description}
          </p>
        )}
      </section>

      {children}
    </div>
  )
}
