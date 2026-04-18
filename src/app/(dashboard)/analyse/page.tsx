"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, PieChart } from "lucide-react";
import {
  Timestamp,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, DonutChart } from "../_components/ui";

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

type StaffOption = {
  id: string;
  name: string;
  email: string;
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

function formatRangeLabel(range: "7d" | "30d" | "all") {
  if (range === "7d") return "Last 7 Days";
  if (range === "30d") return "Last 30 Days";
  return "All Time";
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

export default function AnalysePage() {
  const [rows, setRows] = useState<CallResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ResponseKey | "All">("All");
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffEmail, setStaffEmail] = useState<string>("all");

  useEffect(() => {
    const base = collection(db, "staff_call_responses");
    const q =
      range === "all"
        ? query(base, orderBy("createdAt", "desc"), limit(1000))
        : query(
            base,
            where(
              "createdAt",
              ">=",
              Timestamp.fromMillis(
                Date.now() -
                  (range === "7d"
                    ? 7 * 24 * 60 * 60 * 1000
                    : 30 * 24 * 60 * 60 * 1000),
              ),
            ),
            orderBy("createdAt", "desc"),
            limit(1000),
          );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const nextRows: CallResponseRow[] = snap.docs.map((d) => {
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
            staffEmail: data.staffEmail ?? "",
            staffName: data.staffName ?? "",
            time: data.time ?? "",
            scheduledAt: data.scheduledAt,
            scheduledAtMillis: data.scheduledAtMillis,
          };
        });
        setRows(nextRows);
        setLoading(false);
      },
      () => {
        setRows([]);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [range]);

  useEffect(() => {
    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const nextStaff: StaffOption[] = snap.docs.map((d) => {
          const data = d.data() as { name?: string; email?: string };
          return {
            id: d.id,
            name: data.name ?? "",
            email: data.email ?? "",
          };
        });
        setStaff(nextStaff);
      },
      () => {
        setStaff([]);
      },
    );
    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      const k = normalizeResponse(r.response);
      if (status !== "All" && k !== status) return false;
      if (staffEmail !== "all") {
        const email = r.staffEmail.trim().toLowerCase();
        if (email !== staffEmail) return false;
      }
      if (!q) return true;
      return (
        r.leadName.toLowerCase().includes(q) ||
        r.leadNumber.toLowerCase().includes(q) ||
        r.staffName.toLowerCase().includes(q) ||
        r.staffEmail.toLowerCase().includes(q) ||
        r.response.toLowerCase().includes(q)
      );
    });
  }, [rows, search, staffEmail, status]);

  const counts = useMemo(() => {
    const next: Record<ResponseKey, number> = {
      Picked: 0,
      Busy: 0,
      Interested: 0,
      Schedule: 0,
      "Not Interested": 0,
      Other: 0,
    };
    for (const r of filtered) next[normalizeResponse(r.response)] += 1;
    return next;
  }, [filtered]);

  const total = useMemo(() => {
    return responseOrder.reduce((acc, k) => acc + (counts[k] ?? 0), 0);
  }, [counts]);

  const donutSegments = useMemo(() => {
    return responseOrder
      .map((k) => ({ key: k, value: counts[k] ?? 0 }))
      .filter((s) => s.value > 0)
      .map((s) => ({ value: s.value, color: colorFor(s.key) }));
  }, [counts]);

  const barMax = useMemo(() => {
    return Math.max(...responseOrder.map((k) => counts[k] ?? 0), 1);
  }, [counts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Analyse</div>
          <div className="mt-1 text-sm text-slate-500">
            Picked, Busy, Interested, Schedule, Not Interested from Firestore.
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
            value={staffEmail}
            onChange={(e) => setStaffEmail(e.target.value)}
          >
            <option value="all">All Staff</option>
            {staff
              .filter((s) => Boolean(s.email))
              .map((s) => (
                <option key={s.id} value={s.email.trim().toLowerCase()}>
                  {s.name ? `${s.name} (${s.email})` : s.email}
                </option>
              ))}
          </select>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:w-[280px]"
            placeholder="Search lead / staff / number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-6">
        <Card className="md:col-span-2">
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">{loading ? "—" : total}</div>
              <div className="mt-1 text-xs text-slate-500">
                Total Responses ({formatRangeLabel(range)})
              </div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900/10 text-slate-700">
              <BarChart3 size={18} />
            </div>
          </div>
        </Card>

        {(["Picked", "Interested", "Schedule", "Busy"] as const).map((k) => (
          <Card key={k}>
            <button
              type="button"
              className="block w-full text-left"
              onClick={() => setStatus((s) => (s === k ? "All" : k))}
            >
              <div className="flex items-start justify-between p-5">
                <div>
                  <div className="text-xl font-semibold">
                    {loading ? "—" : counts[k]}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{k}</div>
                </div>
                <div
                  className={[
                    "grid h-9 w-9 place-items-center rounded-xl",
                    toneFor(k),
                  ].join(" ")}
                >
                  <PieChart size={18} />
                </div>
              </div>
            </button>
          </Card>
        ))}

        <Card>
          <button
            type="button"
            className="block w-full text-left"
            onClick={() =>
              setStatus((s) => (s === "Not Interested" ? "All" : "Not Interested"))
            }
          >
            <div className="flex items-start justify-between p-5">
              <div>
                <div className="text-xl font-semibold">
                  {loading ? "—" : counts["Not Interested"]}
                </div>
                <div className="mt-1 text-xs text-slate-500">Not Interested</div>
              </div>
              <div
                className={[
                  "grid h-9 w-9 place-items-center rounded-xl",
                  toneFor("Not Interested"),
                ].join(" ")}
              >
                <PieChart size={18} />
              </div>
            </div>
          </button>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between px-6 pt-6">
            <div>
              <div className="text-sm font-semibold">Response Mix</div>
              <div className="mt-1 text-xs text-slate-500">
                Distribution by call response.
              </div>
            </div>
            <div
              className={[
                "rounded-xl px-3 py-1 text-xs font-semibold",
                status === "All" ? "bg-slate-50 text-slate-600" : toneFor(status),
              ].join(" ")}
            >
              {status === "All" ? "All" : status}
            </div>
          </div>

          <div className="px-6 pb-6 pt-4">
            <div className="flex items-center justify-between gap-6">
              <DonutChart segments={donutSegments.length ? donutSegments : [{ value: 1, color: "rgba(148,163,184,0.25)" }]} />
              <div className="min-w-0 flex-1 space-y-2">
                {responseOrder
                  .filter((k) => (counts[k] ?? 0) > 0)
                  .map((k) => {
                    const v = counts[k] ?? 0;
                    const pct = total ? Math.round((v / total) * 100) : 0;
                    return (
                      <button
                        key={k}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => setStatus((s) => (s === k ? "All" : k))}
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
                      </button>
                    );
                  })}
                {!loading && total === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    No responses found.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between px-6 pt-6">
            <div>
              <div className="text-sm font-semibold">Response Chart</div>
              <div className="mt-1 text-xs text-slate-500">
                Counts by response type.
              </div>
            </div>
            <button
              type="button"
              className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setSearch("");
                setStatus("All");
                setStaffEmail("all");
              }}
            >
              Reset Filters
            </button>
          </div>

          <div className="px-6 pb-6 pt-4">
            <div className="grid grid-cols-6 items-end gap-3">
              {responseOrder.map((k) => {
                const v = counts[k] ?? 0;
                const pct = Math.max(4, Math.round((v / barMax) * 100));
                return (
                  <button
                    key={k}
                    type="button"
                    className="flex h-[220px] flex-col items-stretch justify-end gap-2"
                    onClick={() => setStatus((s) => (s === k ? "All" : k))}
                    title={`${k}: ${v}`}
                  >
                    <div
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 transition-transform hover:-translate-y-1"
                      style={{ height: `${v === 0 ? 10 : pct}%` }}
                    >
                      <div
                        className="h-full w-full rounded-xl"
                        style={{
                          background:
                            `repeating-linear-gradient(135deg,${colorFor(k)} 0px,${colorFor(k)} 2px,rgba(255,255,255,0.0) 2px,rgba(255,255,255,0.0) 7px)`,
                          opacity: 0.28,
                        }}
                      />
                    </div>
                    <div className="text-center text-xs font-semibold text-slate-700">
                      {v}
                    </div>
                    <div className="text-center text-[11px] font-semibold text-slate-500">
                      {k === "Not Interested" ? "Not Int." : k}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 overflow-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Lead</th>
                    <th className="px-6 py-3">Number</th>
                    <th className="px-6 py-3">Response</th>
                    <th className="px-6 py-3">Staff</th>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Scheduled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.slice(0, 30).map((r) => {
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
                            {r.staffName || "—"}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {r.staffEmail || "—"}
                          </div>
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
                </tbody>
              </table>
            </div>

            {!loading && filtered.length > 30 ? (
              <div className="mt-3 text-xs font-semibold text-slate-500">
                Showing 30 of {filtered.length} records (use search/filters to narrow).
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
