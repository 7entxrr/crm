"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DashboardTab = {
  label: string;
  href: string;
};

export default function DashboardTabs({ tabs }: { tabs: DashboardTab[] }) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold transition-colors",
              isActive
                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

