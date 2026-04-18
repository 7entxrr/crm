"use client";

import type { ComponentType } from "react";
import {
  Activity,
  LayoutDashboard,
  PieChart,
  Settings,
  TrendingUp,
  User,
  Users,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SidebarIconKey =
  | "dashboard"
  | "employees"
  | "leads"
  | "customer"
  | "tracking"
  | "analyse"
  | "upload-leads"
  | "settings";

export type SidebarItem = {
  label: string;
  href: string;
  icon: SidebarIconKey;
  badge?: string;
};

export type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

const iconMap: Record<
  SidebarIconKey,
  ComponentType<{ size?: number; className?: string }>
> = {
  dashboard: LayoutDashboard,
  employees: Users,
  leads: TrendingUp,
  customer: User,
  tracking: Activity,
  analyse: PieChart,
  "upload-leads": Upload,
  settings: Settings,
};

export default function Sidebar({ sections }: { sections: SidebarSection[] }) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="flex-1 overflow-auto px-3 pb-6">
      {sections.map((section) => (
        <div key={section.title} className="mt-6">
          <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {section.title}
          </div>
          <div className="mt-2 space-y-1">
            {section.items.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = iconMap[item.icon];

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  <Icon
                    size={18}
                    className={isActive ? "text-white" : "text-slate-400"}
                  />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
