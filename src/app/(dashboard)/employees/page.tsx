"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Mail, Users } from "lucide-react";
import {
  Timestamp,
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, getSecondaryAuth } from "@/lib/firebase";
import { BarsMini, Card, DonutChart } from "../_components/ui";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt?: Date | null;
};

type ResponseKey =
  | "Picked"
  | "Busy"
  | "Interested"
  | "Schedule"
  | "Not Interested"
  | "Other";

type CallResponseRow = {
  id: string;
  createdAt: Date | null;
  leadName: string;
  leadNumber: string;
  response: string;
  staffEmail: string;
  staffName: string;
  time: string;
  scheduledAt?: string;
  scheduledAtMillis?: number;
};

function normalizeResponse(raw: unknown): ResponseKey {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "Other";
  if (v === "picked") return "Picked";
  if (v === "busy") return "Busy";
  if (v === "interested") return "Interested";
  if (v === "schedule" || v === "scheduled") return "Schedule";
  if (v === "not interested" || v === "not_interested" || v === "notinterested")
    return "Not Interested";
  return "Other";
}

function toneFor(key: ResponseKey) {
  if (key === "Picked") return "bg-emerald-500/10 text-emerald-700";
  if (key === "Interested") return "bg-blue-500/10 text-blue-700";
  if (key === "Schedule") return "bg-violet-500/10 text-violet-700";
  if (key === "Busy") return "bg-slate-900/10 text-slate-700";
  if (key === "Not Interested") return "bg-rose-500/10 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function colorFor(key: ResponseKey) {
  if (key === "Picked") return "rgba(16,185,129,0.95)";
  if (key === "Interested") return "rgba(59,130,246,0.95)";
  if (key === "Schedule") return "rgba(139,92,246,0.95)";
  if (key === "Busy") return "rgba(15,23,42,0.75)";
  if (key === "Not Interested") return "rgba(244,63,94,0.9)";
  return "rgba(148,163,184,0.95)";
}

const responseOrder: ResponseKey[] = [
  "Picked",
  "Interested",
  "Schedule",
  "Busy",
  "Not Interested",
  "Other",
];

function describeResponse(key: ResponseKey) {
  if (key === "Picked") return "Lead answered the call (picked up).";
  if (key === "Busy") return "Lead was busy / call not possible right now.";
  if (key === "Interested") return "Lead showed interest to continue conversation.";
  if (key === "Schedule") return "Follow-up is scheduled for a specific time.";
  if (key === "Not Interested") return "Lead declined and is not interested.";
  return "Uncategorized / unknown response value.";
}

function formatPercent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export default function EmployeesPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");
  const [selectedStaffEmail, setSelectedStaffEmail] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<ResponseKey | "All">("All");
  const [callRows, setCallRows] = useState<CallResponseRow[]>([]);
  const [callLoading, setCallLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setSearch(q);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows: StaffRow[] = snap.docs.map((d) => {
          const data = d.data() as {
            name?: string;
            email?: string;
            password?: string;
            createdAt?: { toDate?: () => Date } | null;
          };

          return {
            id: d.id,
            name: data.name ?? "",
            email: data.email ?? "",
            password: data.password,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          };
        });
        setStaff(rows);
      },
      () => {
        setStaff([]);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const base = collection(db, "staff_call_responses");
    const ms =
      range === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : range === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : null;

    const constraints: Parameters<typeof query>[1][] = [];
    if (ms) {
      constraints.push(where("createdAt", ">=", Timestamp.fromMillis(Date.now() - ms)));
    }
    if (selectedStaffEmail !== "all") {
      constraints.push(where("staffEmail", "==", selectedStaffEmail));
    }
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(1000));

    const q = query(base, ...constraints);

    setCallLoading(true);
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next: CallResponseRow[] = snap.docs.map((d) => {
          const data = d.data() as {
            createdAt?: { toDate?: () => Date } | null;
            leadName?: string;
            leadNumber?: string;
            response?: string;
            staffEmail?: string;
            staffName?: string;
            time?: string;
            scheduledAt?: string;
            scheduledAtMillis?: number;
          };

          return {
            id: d.id,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            leadName: data.leadName ?? "",
            leadNumber: data.leadNumber ?? "",
            response: data.response ?? "",
            staffEmail: String(data.staffEmail ?? "").trim().toLowerCase(),
            staffName: data.staffName ?? "",
            time: data.time ?? "",
            scheduledAt: data.scheduledAt,
            scheduledAtMillis: data.scheduledAtMillis,
          };
        });
        setCallRows(next);
        setCallLoading(false);
      },
      () => {
        setCallRows([]);
        setCallLoading(false);
      },
    );

    return unsubscribe;
  }, [range, selectedStaffEmail]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
  }, [staff, search]);

  const totalEmployees = staff.length;
  const staffOptions = useMemo(() => {
    return staff
      .filter((s) => Boolean(s.email))
      .map((s) => ({
        email: s.email.trim().toLowerCase(),
        label: s.name ? `${s.name} (${s.email})` : s.email,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [staff]);

  const callRowsFiltered = useMemo(() => {
    if (statusFilter === "All") return callRows;
    return callRows.filter((r) => normalizeResponse(r.response) === statusFilter);
  }, [callRows, statusFilter]);

  const counts = useMemo(() => {
    const next: Record<ResponseKey, number> = {
      Picked: 0,
      Busy: 0,
      Interested: 0,
      Schedule: 0,
      "Not Interested": 0,
      Other: 0,
    };
    for (const r of callRowsFiltered) next[normalizeResponse(r.response)] += 1;
    return next;
  }, [callRowsFiltered]);

  const totalResponses = useMemo(() => {
    return responseOrder.reduce((acc, k) => acc + (counts[k] ?? 0), 0);
  }, [counts]);

  const donutSegments = useMemo(() => {
    const segs = responseOrder
      .map((k) => ({ key: k, value: counts[k] ?? 0 }))
      .filter((s) => s.value > 0)
      .map((s) => ({ value: s.value, color: colorFor(s.key) }));

    return segs.length ? segs : [{ value: 1, color: "rgba(148,163,184,0.25)" }];
  }, [counts]);

  const perEmployee = useMemo(() => {
    const map = new Map<
      string,
      { email: string; name: string; total: number; counts: Record<ResponseKey, number> }
    >();

    for (const r of callRowsFiltered) {
      const email = r.staffEmail.trim().toLowerCase() || "unknown";
      const existing = map.get(email);
      const key = normalizeResponse(r.response);
      if (existing) {
        existing.total += 1;
        existing.counts[key] += 1;
        if (!existing.name && r.staffName) existing.name = r.staffName;
      } else {
        map.set(email, {
          email,
          name: r.staffName ?? "",
          total: 1,
          counts: {
            Picked: key === "Picked" ? 1 : 0,
            Busy: key === "Busy" ? 1 : 0,
            Interested: key === "Interested" ? 1 : 0,
            Schedule: key === "Schedule" ? 1 : 0,
            "Not Interested": key === "Not Interested" ? 1 : 0,
            Other: key === "Other" ? 1 : 0,
          },
        });
      }
    }

    const staffByEmail = new Map(staff.map((s) => [s.email.trim().toLowerCase(), s]));
    for (const e of map.values()) {
      const staffRow = staffByEmail.get(e.email);
      if (staffRow?.name) e.name = staffRow.name;
    }

    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [callRowsFiltered, staff]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Employees</div>
          <div className="mt-1 text-sm text-slate-500">
            Manage staff, roles, and performance.
          </div>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0b1220] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-200"
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">{totalEmployees}</div>
              <div className="mt-1 text-xs text-slate-500">Total Employees</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Users size={18} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">—</div>
              <div className="mt-1 text-xs text-slate-500">New This Month</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
              <BadgeCheck size={18} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">—</div>
              <div className="mt-1 text-xs text-slate-500">On Leave</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <BadgeCheck size={18} />
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Employee Analytics</div>
            <div className="mt-1 text-xs text-slate-500">
              Graphs from Firestore collection: staff_call_responses
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              value={range}
              onChange={(e) => setRange(e.target.value as "7d" | "30d" | "all")}
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
            <select
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              value={selectedStaffEmail}
              onChange={(e) => {
                setSelectedStaffEmail(e.target.value);
              }}
            >
              <option value="all">All Employees</option>
              {staffOptions.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ResponseKey | "All")}
            >
              <option value="All">All Status</option>
              {responseOrder.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setRange("30d");
                setSelectedStaffEmail("all");
                setStatusFilter("All");
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total Responses
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {callLoading ? "—" : totalResponses}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-slate-500">
                    {selectedStaffEmail === "all"
                      ? "All Employees"
                      : staffOptions.find((s) => s.email === selectedStaffEmail)?.label ??
                        selectedStaffEmail}
                  </div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700">
                  <Users size={18} />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-6">
                <DonutChart segments={donutSegments} />
                <div className="min-w-0 flex-1 space-y-2">
                  {responseOrder.map((k) => {
                    const v = counts[k] ?? 0;
                    const pct = totalResponses ? Math.round((v / totalResponses) * 100) : 0;
                    return (
                      <div
                        key={k}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: colorFor(k) }}
                          />
                          <span className="truncate">{k}</span>
                        </span>
                        <span className="shrink-0 text-slate-500">
                          {v} • {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {selectedStaffEmail === "all" ? (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <div>
                    <div className="text-sm font-semibold">Team Leaderboard</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Responses per employee (top 12)
                    </div>
                  </div>
                </div>

                <div className="overflow-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-3">Employee</th>
                        <th className="px-6 py-3">Total</th>
                        <th className="px-6 py-3">Picked</th>
                        <th className="px-6 py-3">Interested</th>
                        <th className="px-6 py-3">Schedule</th>
                        <th className="px-6 py-3">Busy</th>
                        <th className="px-6 py-3">Not Interested</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {perEmployee.slice(0, 12).map((e) => (
                        <tr
                          key={e.email}
                          className="hover:bg-slate-50/70 cursor-pointer"
                          onClick={() => setSelectedStaffEmail(e.email)}
                        >
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">
                              {e.name || "—"}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {e.email === "unknown" ? "Unknown" : e.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-900">
                            {e.total}
                          </td>
                          <td className="px-6 py-4 text-slate-700">
                            {e.counts.Picked}
                          </td>
                          <td className="px-6 py-4 text-slate-700">
                            {e.counts.Interested}
                          </td>
                          <td className="px-6 py-4 text-slate-700">
                            {e.counts.Schedule}
                          </td>
                          <td className="px-6 py-4 text-slate-700">{e.counts.Busy}</td>
                          <td className="px-6 py-4 text-slate-700">
                            {e.counts["Not Interested"]}
                          </td>
                        </tr>
                      ))}
                      {!callLoading && perEmployee.length === 0 ? (
                        <tr>
                          <td
                            className="px-6 py-8 text-center text-sm font-semibold text-slate-500"
                            colSpan={7}
                          >
                            No call responses found for the selected filters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <div>
                    <div className="text-sm font-semibold">Employee Breakdown</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Response counts by type
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
                  {responseOrder.map((k) => (
                    <div
                      key={k}
                      className="group relative rounded-2xl border border-slate-100 p-4 transition hover:border-slate-200 hover:bg-slate-50/40 hover:shadow-sm"
                    >
                      <div className="pointer-events-none absolute inset-x-4 -top-2 z-10 hidden -translate-y-full rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-[0_18px_40px_rgba(15,23,42,0.14)] group-hover:block">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900">
                              {k}
                            </div>
                            <div className="mt-1 text-[11px] font-semibold text-slate-500">
                              {describeResponse(k)}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-xs font-semibold text-slate-900">
                              {callLoading ? "—" : counts[k] ?? 0}
                            </div>
                            <div className="mt-1 text-[11px] font-semibold text-slate-500">
                              {callLoading
                                ? "—"
                                : formatPercent(counts[k] ?? 0, totalResponses)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="text-[11px] font-semibold text-slate-600">
                            Total in current view
                          </div>
                          <div className="text-[11px] font-semibold text-slate-900">
                            {callLoading ? "—" : totalResponses}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {k}
                        </div>
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            toneFor(k),
                          ].join(" ")}
                        >
                          {callLoading ? "—" : counts[k] ?? 0}
                        </span>
                      </div>
                      <div className="mt-4">
                        <BarsMini values={[counts[k] ?? 0, Math.max(1, Math.round((totalResponses || 1) / 6))]} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 px-6 py-5">
                  <div className="text-sm font-semibold">Recent Calls</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Latest 20 records for this employee
                  </div>
                </div>

                <div className="overflow-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-3">Lead</th>
                        <th className="px-6 py-3">Number</th>
                        <th className="px-6 py-3">Response</th>
                        <th className="px-6 py-3">Time</th>
                        <th className="px-6 py-3">Scheduled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {callRowsFiltered.slice(0, 20).map((r) => {
                        const k = normalizeResponse(r.response);
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/70">
                            <td className="px-6 py-4 font-semibold text-slate-900">
                              {r.leadName || "—"}
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              {r.leadNumber || "—"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={[
                                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                                  toneFor(k),
                                ].join(" ")}
                              >
                                {k}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              <div className="font-semibold text-slate-900">
                                {r.time || "—"}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {r.createdAt ? r.createdAt.toLocaleString() : "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              {r.scheduledAt
                                ? r.scheduledAt
                                : r.scheduledAtMillis
                                  ? new Date(r.scheduledAtMillis).toLocaleString()
                                  : "—"}
                            </td>
                          </tr>
                        );
                      })}
                      {!callLoading && callRowsFiltered.length === 0 ? (
                        <tr>
                          <td
                            className="px-6 py-8 text-center text-sm font-semibold text-slate-500"
                            colSpan={5}
                          >
                            No call responses found for the selected filters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <div className="text-sm font-semibold">Team Directory</div>
            <div className="mt-1 text-xs text-slate-500">
              Staff list from Firestore collection: staff
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="h-10 w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{e.name}</div>
                    <div className="text-xs text-slate-500">Staff</div>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{e.email}</td>
                  <td className="px-6 py-4 text-slate-700">
                    {e.createdAt ? e.createdAt.toLocaleString() : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Mail size={14} /> Email
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (saving) return;
              setOpen(false);
            }}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[520px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold">Add Employee</div>
                <div className="mt-1 text-xs text-slate-500">
                  Saves to Firestore collection staff
                </div>
              </div>
              <button
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                type="button"
                onClick={() => {
                  if (saving) return;
                  setOpen(false);
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
                  const trimmedName = name.trim();
                  const trimmedEmail = email.trim();
                  if (!trimmedName || !trimmedEmail || !password) {
                    setError("Please fill name, email and password.");
                    return;
                  }

                  const secondaryAuth = getSecondaryAuth();
                  const userCred = await createUserWithEmailAndPassword(
                    secondaryAuth,
                    trimmedEmail,
                    password,
                  );

                  await addDoc(collection(db, "staff"), {
                    name: trimmedName,
                    email: trimmedEmail,
                    password,
                    uid: userCred.user.uid,
                    createdAt: serverTimestamp(),
                  });

                  setName("");
                  setEmail("");
                  setPassword("");
                  setOpen(false);
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : "Failed to add employee";
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Employee name"
                  required
                />
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  type="password"
                  autoComplete="new-password"
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
                    setOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
