"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  Flag,
  LayoutGrid,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "./sidebar";
import type { SidebarSection } from "./sidebar";
import AdminIdentity from "./admin-identity";
import LogoutButton from "./logout-button";

type LeadRow = {
  id: string;
  name: string;
  number: string;
  normalizedNumber: string;
  assignedToName: string;
  assignedToEmail: string;
  createdAt: Date | null;
};

type CallResponseRow = {
  id: string;
  response: string;
  staffName: string;
  staffEmail: string;
  createdAt: Date | null;
};

type AdminSession = { email?: string; name?: string } | null;

function readSession(): AdminSession {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("clearlands_admin_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

function normalizeSearch(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

function isLikelyPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7;
}

function applyTheme(next: "system" | "light" | "dark") {
  if (typeof document === "undefined") return;
  if (next === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", next);
  }
}

export default function DashboardHeader({
  sections,
}: {
  sections: SidebarSection[];
}) {
  const router = useRouter();
  usePathname();

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("clearlands_theme");
    return stored === "dark" ? "dark" : "light";
  });

  const [recentLeads, setRecentLeads] = useState<LeadRow[]>([]);
  const [recentResponses, setRecentResponses] = useState<CallResponseRow[]>([]);

  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applyTheme(theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("clearlands_theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && searchWrapRef.current && !searchWrapRef.current.contains(t)) {
        setSearchOpen(false);
      }
      if (t && menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
      if (t && notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const q1 = query(collection(db, "call_numbers"), orderBy("createdAt", "desc"), limit(6));
    const u1 = onSnapshot(
      q1,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as {
            name?: string;
            number?: string;
            normalizedNumber?: string;
            assignedToName?: string;
            assignedToEmail?: string;
            createdAt?: { toDate?: () => Date } | null;
          };
          return {
            id: d.id,
            name: data.name ?? "",
            number: data.number ?? "",
            normalizedNumber: data.normalizedNumber ?? "",
            assignedToName: data.assignedToName ?? "",
            assignedToEmail: String(data.assignedToEmail ?? "").trim().toLowerCase(),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          } satisfies LeadRow;
        });
        setRecentLeads(rows);
      },
      () => setRecentLeads([]),
    );

    const q2 = query(
      collection(db, "staff_call_responses"),
      orderBy("createdAt", "desc"),
      limit(6),
    );
    const u2 = onSnapshot(
      q2,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as {
            response?: string;
            staffName?: string;
            staffEmail?: string;
            createdAt?: { toDate?: () => Date } | null;
          };
          return {
            id: d.id,
            response: data.response ?? "",
            staffName: data.staffName ?? "",
            staffEmail: String(data.staffEmail ?? "").trim().toLowerCase(),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          } satisfies CallResponseRow;
        });
        setRecentResponses(rows);
      },
      () => setRecentResponses([]),
    );

    return () => {
      u1();
      u2();
    };
  }, [notifOpen]);

  const quickLinks = useMemo(() => {
    const items = [
      { label: "Dashboard", href: "/" },
      { label: "Employees", href: "/employees" },
      { label: "Leads", href: "/leads" },
      { label: "Tracking", href: "/tracking" },
      { label: "Analyse", href: "/analyse" },
      { label: "Settings", href: "/settings" },
    ];
    const q = normalizeSearch(search).toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [search]);

  const session = useMemo(() => readSession(), []);

  return (
    <>
      <header className="flex h-16 items-center justify-between gap-4 bg-white px-4 shadow-[0_1px_0_0_rgba(15,23,42,0.06)] sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0b1220] text-white lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <div ref={searchWrapRef} className="relative w-[240px] max-w-[55vw] sm:w-[340px]">
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              placeholder="Search pages or type a number…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
                if (e.key !== "Enter") return;
                const q = normalizeSearch(search);
                if (!q) return;
                if (isLikelyPhone(q)) {
                  router.push(`/leads?q=${encodeURIComponent(q)}`);
                  setSearchOpen(false);
                  return;
                }
                const match = quickLinks[0];
                if (match && match.label.toLowerCase() === q.toLowerCase()) {
                  router.push(match.href);
                  setSearchOpen(false);
                  return;
                }
                router.push(`/leads?q=${encodeURIComponent(q)}`);
                setSearchOpen(false);
              }}
            />
            <div className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-slate-400">
              <Search size={18} />
            </div>

            {searchOpen ? (
              <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Quick Navigation
                </div>
                <div className="border-t border-slate-100">
                  {quickLinks.slice(0, 6).map((i) => (
                    <button
                      key={i.href}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        router.push(i.href);
                        setSearchOpen(false);
                      }}
                    >
                      <span>{i.label}</span>
                      <span className="text-xs font-semibold text-slate-400">{i.href}</span>
                    </button>
                  ))}

                  {search.trim() && isLikelyPhone(search) ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        router.push(`/leads?q=${encodeURIComponent(search)}`);
                        setSearchOpen(false);
                      }}
                    >
                      <span>Search in Leads</span>
                      <span className="text-xs font-semibold text-slate-400">
                        {search.replace(/\D/g, "")}
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div ref={notifRef} className="relative">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>

            {notifOpen ? (
              <div className="absolute right-0 top-12 z-50 w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">Activity</div>
                  <button
                    type="button"
                    className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setNotifOpen(false);
                      router.push("/analyse");
                    }}
                  >
                    View Analyse
                  </button>
                </div>
                <div className="border-t border-slate-100">
                  <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Recent Leads
                  </div>
                  <div className="px-2 pb-2">
                    {recentLeads.slice(0, 4).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          setNotifOpen(false);
                          router.push(`/leads?q=${encodeURIComponent(l.normalizedNumber || l.number)}`);
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {l.name || "Lead"}
                            </div>
                            <div className="mt-0.5 text-xs font-semibold text-slate-500">
                              {l.normalizedNumber || l.number || "—"}
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-xs font-semibold text-slate-500">
                            {l.createdAt ? l.createdAt.toLocaleDateString() : "—"}
                          </div>
                        </div>
                      </button>
                    ))}
                    {!recentLeads.length ? (
                      <div className="px-3 py-3 text-xs font-semibold text-slate-500">
                        No recent leads.
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Recent Responses
                  </div>
                  <div className="px-2 pb-3">
                    {recentResponses.slice(0, 4).map((r) => (
                      <div
                        key={r.id}
                        className="rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {r.response || "Response"}
                            </div>
                            <div className="mt-0.5 text-xs font-semibold text-slate-500">
                              {r.staffName || r.staffEmail || "—"}
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-xs font-semibold text-slate-500">
                            {r.createdAt ? r.createdAt.toLocaleTimeString() : "—"}
                          </div>
                        </div>
                      </div>
                    ))}
                    {!recentResponses.length ? (
                      <div className="px-3 py-3 text-xs font-semibold text-slate-500">
                        No recent responses.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100"
              onClick={() => router.push("/settings")}
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100"
              onClick={() => router.push("/tracking")}
              aria-label="Tracking"
            >
              <Flag size={18} />
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100"
              onClick={() => router.push("/")}
              aria-label="Dashboard"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100"
              onClick={() => {
                setTheme((t) => (t === "dark" ? "light" : "dark"));
              }}
              aria-label="Toggle theme"
              title={`Theme: ${theme}`}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <div ref={menuRef} className="relative ml-1">
            <button
              type="button"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
            >
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-slate-200">
                <User size={18} className="text-slate-600" />
              </div>
              <AdminIdentity />
              <ChevronDown size={16} className="text-slate-500" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-12 z-50 w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                <div className="px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">
                    {session?.name || session?.email || "Admin"}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {session?.email || "—"}
                  </div>
                </div>
                <div className="border-t border-slate-100 p-2">
                  {[
                    { label: "Dashboard", href: "/" },
                    { label: "Employees", href: "/employees" },
                    { label: "Leads", href: "/leads" },
                    { label: "Analyse", href: "/analyse" },
                    { label: "Settings", href: "/settings" },
                  ].map((i) => (
                    <button
                      key={i.href}
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push(i.href);
                      }}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 p-4">
                  <LogoutButton />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-[#0b1220] text-slate-200 shadow-2xl">
            <div className="flex h-16 items-center justify-between px-5">
              <div className="text-sm font-semibold tracking-wide">
                Clear Lands
              </div>
              <button
                type="button"
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                onClick={() => setMobileOpen(false)}
              >
                Close
              </button>
            </div>
            <Sidebar sections={sections} />
          </div>
        </div>
      ) : null}
    </>
  );
}
