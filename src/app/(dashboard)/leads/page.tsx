"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, UserPlus, Users } from "lucide-react";
import {
  addDoc, 
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, DonutChart } from "../_components/ui";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  createdAt?: Date | null;
};

type LeadRow = {
  id: string;
  name: string;
  number: string;
  normalizedNumber: string;
  assignedToName: string;
  assignedToEmail: string;
  createdAt: Date | null;
  assignedAt: Date | null;
};

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

function toWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function whatsAppLink(raw: string, text?: string) {
  const wa = toWhatsAppNumber(raw);
  if (!wa) return "";
  const base = `https://wa.me/${encodeURIComponent(wa)}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

type WhatsAppTemplate = {
  id: string;
  label: string;
  body: string;
};

const defaultWhatsAppTemplates: WhatsAppTemplate[] = [
  {
    id: "intro",
    label: "Intro Message",
    body: "Hi {name}, this is Evohus. Thank you for your interest. Can you share your preferred budget, location, and move-in timeline?",
  },
  {
    id: "follow_up",
    label: "Follow-up",
    body: "Hi {name}, just following up regarding your property requirement. Are you available for a quick call today?",
  },
  {
    id: "schedule",
    label: "Schedule a Call",
    body: "Hi {name}, please share a suitable time for a call today/tomorrow. I’ll confirm and call you as per your convenience.",
  },
  {
    id: "requirements",
    label: "Share Requirements",
    body: "Hi {name}, to suggest the best options, please share: 1) Location 2) Budget 3) BHK/type 4) Ready-to-move or under construction 5) Preferred date.",
  },
];

function renderTemplate(
  tplBody: string,
  lead: Pick<LeadRow, "name" | "number" | "normalizedNumber">,
) {
  const name = lead.name?.trim() ? lead.name.trim() : "there";
  const phone = lead.normalizedNumber || lead.number;
  return tplBody
    .replaceAll("{name}", name)
    .replaceAll("{number}", phone)
    .replaceAll("{phone}", phone);
}

const TEMPLATE_TITLE_MAX_CHARS = 24;
const TEMPLATE_TITLE_MAX_WORDS = 3;

function normalizeTitleInput(raw: string) {
  return raw.replace(/\s+/g, " ").replace(/^\s+/, "");
}

function titleWordCount(raw: string) {
  const t = raw.trim();
  if (!t) return 0;
  return t.split(" ").filter(Boolean).length;
}

function WhatsAppIcon({ size }: { size: number }) {
  const s = size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M26.7 5.3A14.9 14.9 0 0 0 16 1.1C7.8 1.1 1.1 7.8 1.1 16c0 2.6.7 5.1 2 7.4L1 31l7.8-2.1a14.9 14.9 0 0 0 7.2 1.9h.1c8.2 0 14.9-6.7 14.9-14.9 0-4-1.6-7.8-4.3-10.6Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M16 29.1h-.1a13.1 13.1 0 0 1-6.7-1.9l-.5-.3-4.6 1.2 1.2-4.5-.3-.5A13.1 13.1 0 0 1 2.9 16C2.9 8.7 8.7 2.9 16 2.9c3.5 0 6.8 1.4 9.3 3.9A13 13 0 0 1 29.1 16c0 7.3-5.8 13.1-13.1 13.1Z"
        fill="currentColor"
      />
      <path
        d="M23.7 19.5c-.4-.2-2.4-1.2-2.8-1.3-.4-.1-.7-.2-1 .2-.3.4-1.1 1.3-1.3 1.6-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3.1-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.1-.8l.6-.7c.2-.2.3-.4.4-.7.1-.2.1-.5 0-.7-.1-.2-1-2.3-1.4-3.1-.4-.8-.7-.7-1-.7h-.9c-.3 0-.7.1-1 .5-.4.4-1.3 1.2-1.3 3 0 1.8 1.3 3.5 1.5 3.7.2.2 2.5 3.8 6.1 5.4.9.4 1.6.7 2.1.9.9.3 1.7.3 2.3.2.7-.1 2.4-1 2.7-2 .3-1 .3-1.9.2-2.1-.1-.2-.4-.3-.8-.5Z"
        fill="#ffffff"
      />
    </svg>
  );
}

function parseLeadLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const csv = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (csv.length >= 2) return { name: csv.slice(0, -1).join(", ").trim(), number: csv[csv.length - 1] ?? "" };
  const match = trimmed.match(/^(.*?)(?:\s*[-–—:]\s*|\s+)(\+?\d[\d\s().-]{6,})$/);
  if (match) return { name: (match[1] ?? "").trim(), number: (match[2] ?? "").trim() };
  return { name: "", number: trimmed };
}

function pickAssignee(
  staff: { email: string; name: string }[],
  countsByEmail: Map<string, number>,
) {
  const ordered = [...staff].sort((a, b) => a.email.localeCompare(b.email));
  let best = ordered[0] ?? null;
  let bestCount = best ? countsByEmail.get(best.email) ?? 0 : Number.POSITIVE_INFINITY;
  for (const s of ordered) {
    const c = countsByEmail.get(s.email) ?? 0;
    if (c < bestCount) {
      best = s;
      bestCount = c;
    }
  }
  return best;
}

export default function LeadsPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [staffEmailFilter, setStaffEmailFilter] = useState<string>("all");

  const [openAdd, setOpenAdd] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);

  const [leadName, setLeadName] = useState("");
  const [leadNumber, setLeadNumber] = useState("");

  const [uploadText, setUploadText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    added: number;
    skipped: number;
    invalid: number;
  } | null>(null);
  const [waMenu, setWaMenu] = useState<{
    lead: LeadRow;
    x: number;
    y: number;
  } | null>(null);
  const waMenuRef = useRef<HTMLDivElement | null>(null);

  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>(
    defaultWhatsAppTemplates,
  );
  const [openWaTemplates, setOpenWaTemplates] = useState(false);
  const [tplLabel, setTplLabel] = useState("");
  const [tplBody, setTplBody] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setSearch(q);
    const staff = params.get("staff");
    if (staff) setStaffEmailFilter(staff.trim().toLowerCase());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (waMenuRef.current && waMenuRef.current.contains(t)) return;
      if (t.closest('[data-wa-button="true"]')) return;
      setWaMenu(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("evohus_wa_templates");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const cleaned: WhatsAppTemplate[] = parsed
        .map((t) => {
          const obj = t as { id?: unknown; label?: unknown; body?: unknown };
          return {
            id: String(obj.id ?? ""),
            label: String(obj.label ?? ""),
            body: String(obj.body ?? ""),
          };
        })
        .filter((t) => t.id && t.label && t.body);
      if (cleaned.length) setWaTemplates(cleaned);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("evohus_wa_templates", JSON.stringify(waTemplates));
  }, [waTemplates]);

  useEffect(() => {
    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows: StaffRow[] = snap.docs.map((d) => {
          const data = d.data() as {
            name?: string;
            email?: string;
            createdAt?: { toDate?: () => Date } | null;
          };
          return {
            id: d.id,
            name: data.name ?? "",
            email: data.email ?? "",
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          };
        });
        setStaff(rows);
      },
      () => setStaff([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "call_numbers"), orderBy("createdAt", "desc"), limit(2000));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows: LeadRow[] = snap.docs.map((d) => {
          const data = d.data() as {
            name?: string;
            number?: string;
            normalizedNumber?: string;
            assignedToName?: string;
            assignedToEmail?: string;
            createdAt?: { toDate?: () => Date } | null;
            assignedAt?: { toDate?: () => Date } | null;
          };
          return {
            id: d.id,
            name: data.name ?? "",
            number: data.number ?? "",
            normalizedNumber: data.normalizedNumber ?? "",
            assignedToName: data.assignedToName ?? "",
            assignedToEmail: String(data.assignedToEmail ?? "").trim().toLowerCase(),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            assignedAt: data.assignedAt?.toDate ? data.assignedAt.toDate() : null,
          };
        });
        setLeads(rows);
        setLoading(false);
      },
      () => {
        setLeads([]);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const staffOptions = useMemo(() => {
    return staff
      .filter((s) => Boolean(s.email))
      .map((s) => ({
        email: s.email.trim().toLowerCase(),
        name: s.name ?? "",
        label: s.name ? `${s.name} (${s.email})` : s.email,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (staffEmailFilter !== "all" && l.assignedToEmail !== staffEmailFilter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.number.toLowerCase().includes(q) ||
        l.normalizedNumber.toLowerCase().includes(q) ||
        l.assignedToName.toLowerCase().includes(q) ||
        l.assignedToEmail.toLowerCase().includes(q)
      );
    });
  }, [leads, search, staffEmailFilter]);

  const totalLeads = leads.length;

  const countsByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) {
      const email = l.assignedToEmail || "unassigned";
      map.set(email, (map.get(email) ?? 0) + 1);
    }
    return map;
  }, [leads]);

  const staffChartItems = useMemo(() => {
    const colors = [
      "rgba(16,185,129,0.95)",
      "rgba(59,130,246,0.95)",
      "rgba(245,158,11,0.95)",
      "rgba(139,92,246,0.95)",
      "rgba(244,63,94,0.9)",
      "rgba(15,23,42,0.75)",
    ];

    return staffOptions.map((s, i) => {
      const value = countsByStaff.get(s.email) ?? 0;
      const color = colors[i % colors.length]!;
      return {
        email: s.email,
        name: s.name,
        label: s.name || s.email,
        fullLabel: s.label,
        value,
        color,
      };
    });
  }, [countsByStaff, staffOptions]);

  const donutSegments = useMemo(() => {
    const nonZero = staffChartItems.filter((i) => i.value > 0);
    if (!nonZero.length)
      return [{ value: 1, color: "rgba(148,163,184,0.25)", label: "No Data" }];
    return nonZero.map((i) => ({ value: i.value, color: i.color, label: i.label }));
  }, [staffChartItems]);

  const topStaff = useMemo(() => {
    const rows = [...staffChartItems].sort((a, b) => b.value - a.value);
    return rows.slice(0, 8);
  }, [staffChartItems]);

  async function addOneLead(payload: { name: string; number: string }) {
    const staffList = staffOptions.map((s) => ({ email: s.email, name: s.name }));
    if (!staffList.length) throw new Error("No employees found. Add employees first.");

    const normalized = normalizePhone(payload.number);
    if (!normalized) throw new Error("Enter a valid phone number.");

    const existing = new Set(leads.map((l) => l.normalizedNumber || normalizePhone(l.number)));
    if (existing.has(normalized)) throw new Error("This phone number already exists.");

    const counts = new Map<string, number>();
    for (const s of staffList) counts.set(s.email, countsByStaff.get(s.email) ?? 0);
    const assignee = pickAssignee(staffList, counts);
    if (!assignee) throw new Error("No employees found. Add employees first.");

    await addDoc(collection(db, "call_numbers"), {
      name: payload.name.trim(),
      number: normalized,
      normalizedNumber: normalized,
      assignedToEmail: assignee.email,
      assignedToName: assignee.name,
      assignedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }

  async function uploadLeads(rawLines: string[]) {
    const staffList = staffOptions.map((s) => ({ email: s.email, name: s.name }));
    if (!staffList.length) throw new Error("No employees found. Add employees first.");

    const existing = new Set(leads.map((l) => l.normalizedNumber || normalizePhone(l.number)));
    const counts = new Map<string, number>();
    for (const s of staffList) counts.set(s.email, countsByStaff.get(s.email) ?? 0);

    let added = 0;
    let skipped = 0;
    let invalid = 0;

    for (const line of rawLines) {
      const parsed = parseLeadLine(line);
      if (!parsed) continue;
      const normalized = normalizePhone(parsed.number);
      if (!normalized) {
        invalid += 1;
        continue;
      }
      if (existing.has(normalized)) {
        skipped += 1;
        continue;
      }
      const assignee = pickAssignee(staffList, counts);
      if (!assignee) throw new Error("No employees found. Add employees first.");

      await addDoc(collection(db, "call_numbers"), {
        name: parsed.name.trim(),
        number: normalized,
        normalizedNumber: normalized,
        assignedToEmail: assignee.email,
        assignedToName: assignee.name,
        assignedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      existing.add(normalized);
      counts.set(assignee.email, (counts.get(assignee.email) ?? 0) + 1);
      added += 1;
    }

    setUploadResult({ added, skipped, invalid });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Leads</div>
          <div className="mt-1 text-sm text-slate-500">
            Upload leads and auto-assign equally across employees.
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0b1220] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-200"
            type="button"
            onClick={() => {
              setError(null);
              setOpenUpload(true);
            }}
          >
            <Upload size={16} /> Upload Leads
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200"
            type="button"
            onClick={() => {
              setError(null);
              setOpenAdd(true);
            }}
          >
            <UserPlus size={16} /> Add Lead
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">Total Leads</div>
                <div className="mt-1 text-xs text-slate-500">
                  Collection: call_numbers
                </div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700">
                <Users size={18} />
              </div>
            </div>
            <div className="mt-5 text-3xl font-semibold text-slate-900">
              {loading ? "—" : totalLeads}
            </div>
            <div className="mt-5 flex items-center justify-between gap-6">
              <DonutChart segments={donutSegments} />
              <div className="min-w-0 flex-1 space-y-2">
                {topStaff.map((s) => (
                  <button
                    key={s.email}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setStaffEmailFilter((v) => (v === s.email ? "all" : s.email))}
                    title={s.fullLabel}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="shrink-0 text-slate-500">{s.value}</span>
                  </button>
                ))}
                {!loading && !topStaff.length ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    Add employees to enable auto-assignment.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Lead List</div>
              <div className="mt-1 text-xs text-slate-500">
                Search, filter by employee, and verify duplicates by phone number.
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                value={staffEmailFilter}
                onChange={(e) => setStaffEmailFilter(e.target.value)}
              >
                <option value="all">All Employees</option>
                {staffOptions.map((s) => (
                  <option key={s.email} value={s.email}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:w-[280px]"
                placeholder="Search name / number / assigned..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-[20%] px-6 py-3">Lead</th>
                  <th className="w-[20%] px-6 py-3">Number</th>
                  <th className="w-[26%] px-6 py-3">Assigned</th>
                  <th className="w-[17%] px-6 py-3">Assigned At</th>
                  <th className="w-[17%] px-6 py-3">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice(0, 50).map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4 font-semibold text-slate-900 break-words">
                      {l.name || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700 break-words">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-slate-900">
                          {l.number || l.normalizedNumber || "—"}
                        </div>
                        {l.number || l.normalizedNumber ? (
                          <div className="relative">
                            <button
                              type="button"
                              data-wa-button="true"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-[#16a34a] shadow-sm transition-colors hover:border-[#16a34a] hover:bg-[#16a34a] hover:text-white focus:outline-none focus:ring-4 focus:ring-emerald-200"
                              aria-label="WhatsApp templates"
                              title="WhatsApp"
                              onClick={(e) => {
                                const target = e.currentTarget as HTMLButtonElement;
                                const rect = target.getBoundingClientRect();
                                const width = 280;
                                const padding = 12;
                                const x = Math.min(
                                  Math.max(padding, rect.left),
                                  window.innerWidth - width - padding,
                                );
                                const y = rect.bottom + 10;
                                setWaMenu((prev) =>
                                  prev?.lead.id === l.id ? null : { lead: l, x, y },
                                );
                              }}
                            >
                              <WhatsAppIcon size={16} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {l.normalizedNumber ? (
                        <div className="mt-0.5 text-xs font-semibold text-slate-500">
                          {l.normalizedNumber}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-slate-700 break-words">
                      <div className="font-semibold text-slate-900">
                        {l.assignedToName || "—"}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {l.assignedToEmail || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {l.assignedAt ? l.assignedAt.toLocaleString() : "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {l.createdAt ? l.createdAt.toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td
                      className="px-6 py-8 text-center text-sm font-semibold text-slate-500"
                      colSpan={5}
                    >
                      No leads found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 50 ? (
            <div className="border-t border-slate-100 px-6 py-3 text-xs font-semibold text-slate-500">
              Showing 50 of {filtered.length} records (use search/filters to narrow).
            </div>
          ) : null}
        </Card>
      </div>

      {waMenu ? (
        <div
          ref={waMenuRef}
          className="fixed z-[80] w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
          style={{ left: waMenu.x, top: waMenu.y }}
        >
          <div className="px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              WhatsApp
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              Message Templates
            </div>
          </div>

          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                const link = whatsAppLink(
                  waMenu.lead.normalizedNumber || waMenu.lead.number,
                );
                window.open(link, "_blank", "noopener,noreferrer");
                setWaMenu(null);
              }}
            >
              Open Chat (No Message)
            </button>
          </div>

          <div className="border-t border-slate-100 p-2">
            {waTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const msg = renderTemplate(tpl.body, waMenu.lead);
                  const link = whatsAppLink(
                    waMenu.lead.normalizedNumber || waMenu.lead.number,
                    msg,
                  );
                  window.open(link, "_blank", "noopener,noreferrer");
                  setWaMenu(null);
                }}
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setWaMenu(null);
                setOpenWaTemplates(true);
              }}
            >
              Manage Templates
            </button>
          </div>
        </div>
      ) : null}

      {openWaTemplates ? (
        <div className="fixed inset-0 z-[90]">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpenWaTemplates(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[560px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold">WhatsApp Templates</div>
                <div className="mt-1 text-xs text-slate-500">
                  Use {"{name}"} to insert lead name.
                </div>
              </div>
              <button
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                type="button"
                onClick={() => setOpenWaTemplates(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Template Name
                  </div>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    value={tplLabel}
                    maxLength={TEMPLATE_TITLE_MAX_CHARS}
                    onChange={(e) => setTplLabel(normalizeTitleInput(e.target.value))}
                    placeholder="e.g. Follow Up"
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
                    <div className="text-slate-500">
                      Max {TEMPLATE_TITLE_MAX_WORDS} words
                    </div>
                    <div
                      className={
                        tplLabel.length > TEMPLATE_TITLE_MAX_CHARS ||
                        titleWordCount(tplLabel) > TEMPLATE_TITLE_MAX_WORDS
                          ? "text-rose-600"
                          : "text-slate-500"
                      }
                    >
                      {tplLabel.length}/{TEMPLATE_TITLE_MAX_CHARS} •{" "}
                      {titleWordCount(tplLabel)}/{TEMPLATE_TITLE_MAX_WORDS}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Message
                  </div>
                  <textarea
                    className="mt-2 h-[140px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    value={tplBody}
                    onChange={(e) => setTplBody(e.target.value)}
                    placeholder="Hi {name}, ..."
                  />
                  <div className="mt-2 text-[11px] font-semibold text-slate-500">
                    Variables: {"{name}"} • {"{phone}"}
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200"
                  onClick={() => {
                    const label = tplLabel.trim();
                    const body = tplBody.trim();
                    if (!label || !body) return;
                    if (
                      label.length > TEMPLATE_TITLE_MAX_CHARS ||
                      titleWordCount(label) > TEMPLATE_TITLE_MAX_WORDS
                    )
                      return;
                    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
                    setWaTemplates((prev) => [{ id, label, body }, ...prev]);
                    setTplLabel("");
                    setTplBody("");
                  }}
                >
                  Add Template
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <div className="bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Existing
                </div>
                <div className="divide-y divide-slate-100">
                  {waTemplates.map((t) => (
                    <div key={t.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {t.label}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">
                            {t.body}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          onClick={() =>
                            setWaTemplates((prev) => prev.filter((x) => x.id !== t.id))
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
                onClick={() => setWaTemplates(defaultWhatsAppTemplates)}
              >
                Reset to Default Templates
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openAdd ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (saving) return;
              setOpenAdd(false);
            }}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[520px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold">Add Lead</div>
                <div className="mt-1 text-xs text-slate-500">
                  Saves to Firestore collection call_numbers
                </div>
              </div>
              <button
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                type="button"
                onClick={() => {
                  if (saving) return;
                  setOpenAdd(false);
                }}
              >
                Close
              </button>
            </div>

            <form
              className="space-y-5 p-6"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setSaving(true);
                try {
                  await addOneLead({ name: leadName, number: leadNumber });
                  setLeadName("");
                  setLeadNumber("");
                  setOpenAdd(false);
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : "Failed to add lead";
                  setError(message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Lead name"
                />
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone Number
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={leadNumber}
                  onChange={(e) => setLeadNumber(e.target.value)}
                  placeholder="9876543210"
                  inputMode="tel"
                  required
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (saving) return;
                    setOpenAdd(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {openUpload ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (saving) return;
              setOpenUpload(false);
            }}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[620px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold">Upload Leads</div>
                <div className="mt-1 text-xs text-slate-500">
                  Paste lines like: Name, 9876543210 (or just 9876543210)
                </div>
              </div>
              <button
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                type="button"
                onClick={() => {
                  if (saving) return;
                  setOpenUpload(false);
                }}
              >
                Close
              </button>
            </div>

            <form
              className="space-y-5 p-6"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setUploadResult(null);
                setSaving(true);
                try {
                  const lines = uploadText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                  if (!lines.length) {
                    setError("Paste at least one lead line.");
                    return;
                  }
                  await uploadLeads(lines);
                  setUploadText("");
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : "Upload failed";
                  setError(message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Paste Leads
                </div>
                <textarea
                  className="mt-2 h-[240px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  placeholder={"Nikhil, 1234567890\nSahil, 0987654321\n1234567890"}
                />
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Upload CSV / Excel (optional)
                </div>
                <input
                  className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={async (e) => {
                    setFileError(null);
                    const file = e.target.files?.[0] ?? null;
                    if (!file) return;
                    try {
                      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
                      if (ext === "xlsx" || ext === "xls") {
                        const buf = await file.arrayBuffer();
                        const XLSX = await import("xlsx");
                        const wb = XLSX.read(buf, { type: "array" });
                        const sheetName = wb.SheetNames[0];
                        const sheet = sheetName ? wb.Sheets[sheetName] : null;
                        if (!sheet) {
                          setFileError("No sheet found in the Excel file.");
                          return;
                        }
                        const rows = XLSX.utils.sheet_to_json(sheet, {
                          header: 1,
                          raw: false,
                          blankrows: false,
                        }) as unknown[][];

                        const lines: string[] = [];
                        for (const r of rows) {
                          const a = String(r?.[0] ?? "").trim();
                          const b = String(r?.[1] ?? "").trim();
                          if (!a && !b) continue;
                          const name = b ? a : "";
                          const number = b ? b : a;
                          lines.push(name ? `${name}, ${number}` : number);
                        }
                        setUploadText(lines.join("\n"));
                      } else {
                        const text = await file.text();
                        setUploadText(text);
                      }
                    } catch {
                      setFileError("Could not read file.");
                    }
                  }}
                />
                {fileError ? (
                  <div className="mt-2 text-xs font-semibold text-rose-600">
                    {fileError}
                  </div>
                ) : null}
              </div>

              {uploadResult ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  Added {uploadResult.added}, Skipped {uploadResult.skipped}, Invalid {uploadResult.invalid}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (saving) return;
                    setOpenUpload(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#0b1220] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Uploading..." : "Upload & Auto-Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
