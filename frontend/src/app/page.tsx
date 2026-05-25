import FeedShell from "@/components/feed/FeedShell";
import ThemeToggle from "@/components/layout/ThemeToggle";
import Link from "next/link";
import { CircleHelp } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header (Mobile) */}
      <div className="verity-card sticky top-0 z-20 mx-1.5 mt-2 flex items-center justify-between p-3 sm:hidden">
        <div className="flex items-center">
          <div className="verity-blob flex h-8 w-8 items-center justify-center bg-sunburst-yellow text-sm font-semibold text-midnight">
            V
            <span className="verity-blob-smile scale-75" />
          </div>
          <span className="ml-3 text-lg font-semibold tracking-[-0.25px] text-charcoal-primary">Verity</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            aria-label="Open Verity guide"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-parchment-card text-graphite shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface hover:text-charcoal-primary"
            href="/how-it-works"
          >
            <CircleHelp className="h-5 w-5" />
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <FeedShell />
    </div>
  );
}
