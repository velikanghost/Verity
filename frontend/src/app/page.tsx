import FeedShell from "@/components/feed/FeedShell";
import ThemeToggle from "@/components/layout/ThemeToggle";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header (Mobile Only) */}
      <div className="sticky top-0 z-20 mx-2 mt-3 flex items-center justify-between rounded-[18px] border border-[(--border)] bg-[(--surface)] p-4 shadow-sm sm:hidden">
        <div className="flex items-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[(--inverse)] text-sm font-black text-[(--inverse-text)]">
            V
          </div>
          <span className="ml-3 text-lg font-black tracking-tight text-[(--foreground)]">Verity</span>
        </div>
        <ThemeToggle />
      </div>

      <FeedShell />
    </div>
  );
}
