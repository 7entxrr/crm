import type { ReactNode } from "react";
import Sidebar from "./_components/sidebar";
import DashboardTabs from "./_components/tabs";
import AuthGate from "./_components/auth-gate";
import type { SidebarSection } from "./_components/sidebar";
import DashboardHeader from "./_components/header";

const sidebarSections: SidebarSection[] = [
  {
    title: "Dashboards",
    items: [
      {
        label: "Dashboard",
        icon: "dashboard",
        href: "/",
        badge: "3",
      },
    ],
  },
  {
    title: "Apps",
    items: [
      { label: "Employees", icon: "employees", href: "/employees" },
      { label: "Leads", icon: "leads", href: "/leads" },
      { label: "Tracking", icon: "tracking", href: "/tracking" },
      { label: "Analyse", icon: "analyse", href: "/analyse" },
      { label: "Settings", icon: "settings", href: "/settings" },
    ],
  },
];

const tabs = [
  { label: "Dashboard", href: "/" },
  { label: "Employees", href: "/employees" },
  { label: "Leads", href: "/leads" },
  { label: "Tracking", href: "/tracking" },
  { label: "Analyse", href: "/analyse" },
  { label: "Settings", href: "/settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-[#f4f6fb] to-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-[264px] shrink-0 flex-col bg-[#0b1220] text-slate-200 lg:flex">
          <div className="flex h-16 items-center gap-2 px-6">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15">
                <LogoMark />
              </div>
              <div className="text-sm font-semibold tracking-wide">
                <span className="text-emerald-400">EVO</span>HUS
              </div>
            </div>
          </div>
          <Sidebar sections={sidebarSections} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader sections={sidebarSections} />

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
            <div className="mx-auto w-full max-w-7xl">
              <div className="mb-5">
                <div className="text-sm font-semibold text-slate-700">
                  Dashboard
                </div>
                <div className="mt-2">
                  <DashboardTabs tabs={tabs} />
                </div>
              </div>
              <AuthGate>{children}</AuthGate>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 12.3 12 5l8 7.3v8.7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8.7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 21V14a2.5 2.5 0 0 1 5 0v7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
