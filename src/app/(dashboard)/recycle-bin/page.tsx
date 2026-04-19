"use client";

import { useEffect, useState } from "react";
import { Check, Trash2, AlertTriangle } from "lucide-react";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type LeadRow = {
  id: string;
  name: string;
  number: string;
  normalizedNumber: string;
  assignedToName: string;
  assignedToEmail: string;
  createdAt: Date | null;
  assignedAt: Date | null;
  location?: string;
  details?: string;
  source?: string;
  status?: string;
  deletedAt?: Date | null;
};

function normalizeSourceName(source: string | undefined): string {
  if (!source) return "";
  const sourceLower = source.toLowerCase().trim();
  
  if (sourceLower.includes("99") || sourceLower.includes("99acres") || sourceLower.includes("99 acres") || sourceLower.includes("99acre")) {
    return "99acres";
  }
  
  if (sourceLower === "mb" || sourceLower.includes("magicbricks") || sourceLower.includes("magic bricks") || sourceLower.includes("magicbrick")) {
    return "MagicBricks";
  }
  
  if (sourceLower.includes("olx")) {
    return "OLX";
  }
  
  if (sourceLower.includes("housing") || sourceLower.includes("housing.com")) {
    return "Housing.com";
  }
  if (sourceLower.includes("commonfloor") || sourceLower.includes("common floor")) {
    return "CommonFloor";
  }
  if (sourceLower.includes("proptiger") || sourceLower.includes("prop tiger")) {
    return "PropTiger";
  }
  if (sourceLower.includes("facebook") || sourceLower.includes("fb")) {
    return "Facebook";
  }
  if (sourceLower.includes("instagram") || sourceLower.includes("insta")) {
    return "Instagram";
  }
  if (sourceLower.includes("whatsapp") || sourceLower.includes("wa")) {
    return "WhatsApp";
  }
  if (sourceLower.includes("google")) {
    return "Google";
  }
  if (sourceLower.includes("justdial")) {
    return "Justdial";
  }
  if (sourceLower.includes("sulekha")) {
    return "Sulekha";
  }
  if (sourceLower.includes("quikr")) {
    return "Quikr";
  }
  if (sourceLower.includes("direct") || sourceLower.includes("referral")) {
    return "Direct/Referral";
  }
  if (sourceLower.includes("website") || sourceLower.includes("web")) {
    return "Website";
  }
  if (sourceLower.includes("cold call")) {
    return "Cold Call";
  }
  if (sourceLower.includes("walk") || sourceLower.includes("walk-in")) {
    return "Walk-in";
  }
  if (sourceLower.includes("exhibition") || sourceLower.includes("expo")) {
    return "Exhibition";
  }
  
  return source;
}

export default function RecycleBinPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [clearTrashConfirm, setClearTrashConfirm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "call_numbers"), orderBy("deletedAt", "desc"), limit(2000));
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
            location?: string;
            details?: string;
            source?: string;
            status?: string;
            deletedAt?: { toDate?: () => Date } | null;
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
            location: data.location ?? "",
            details: data.details ?? "",
            source: data.source ?? "",
            status: data.status ?? "",
            deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : null,
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

  const filtered = leads.filter((l) => {
    if (l.status !== "deleted") return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      l.name.toLowerCase().includes(q) ||
      l.number.toLowerCase().includes(q) ||
      l.normalizedNumber.toLowerCase().includes(q) ||
      l.assignedToName.toLowerCase().includes(q) ||
      l.assignedToEmail.toLowerCase().includes(q) ||
      (l.location && l.location.toLowerCase().includes(q)) ||
      (l.details && l.details.toLowerCase().includes(q)) ||
      (l.source && l.source.toLowerCase().includes(q))
    );
  });

  const handleRestoreLead = async (leadId: string) => {
    try {
      await updateDoc(doc(db, "call_numbers", leadId), {
        status: "",
        deletedAt: null,
      });
    } catch (err) {
      console.error("Failed to restore lead:", err);
    }
  };

  const handleBulkRestoreLeads = async () => {
    try {
      for (const leadId of selectedLeads) {
        await updateDoc(doc(db, "call_numbers", leadId), {
          status: "",
          deletedAt: null,
        });
      }
      setSelectedLeads(new Set());
    } catch (err) {
      console.error("Failed to restore leads:", err);
    }
  };

  const handlePermanentDelete = async (leadId: string) => {
    try {
      await deleteDoc(doc(db, "call_numbers", leadId));
    } catch (err) {
      console.error("Failed to permanently delete lead:", err);
    }
  };

  const handleClearTrash = async () => {
    try {
      for (const lead of filtered) {
        await deleteDoc(doc(db, "call_numbers", lead.id));
      }
      setClearTrashConfirm(false);
      setSelectedLeads(new Set());
    } catch (err) {
      console.error("Failed to clear trash:", err);
    }
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAllLeads = () => {
    const allIds = filtered.map(l => l.id);
    if (selectedLeads.size === allIds.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(allIds));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Recycle Bin</div>
          <div className="mt-1 text-sm text-slate-500">
            View and restore deleted leads. Leads are kept here for recovery.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="border border-slate-200 bg-white rounded-xl shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Deleted Leads</div>
              <div className="mt-1 text-xs text-slate-500">
                {filtered.length} leads in recycle bin
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {filtered.length > 0 && (
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm shadow-red-600/25 transition-colors hover:bg-red-700"
                  type="button"
                  onClick={() => setClearTrashConfirm(true)}
                >
                  <Trash2 size={16} /> Clear Trash ({filtered.length})
                </button>
              )}
              {selectedLeads.size > 0 && (
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600"
                  type="button"
                  onClick={handleBulkRestoreLeads}
                >
                  <Check size={16} /> Restore Selected ({selectedLeads.size})
                </button>
              )}
              <input
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:w-[280px]"
                placeholder="Search deleted leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 w-[50px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      checked={selectedLeads.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAllLeads}
                    />
                  </th>
                  <th className="w-[14%] px-6 py-3">Lead</th>
                  <th className="w-[14%] px-6 py-3">Number</th>
                  <th className="w-[12%] px-6 py-3">Location</th>
                  <th className="w-[12%] px-6 py-3">Source</th>
                  <th className="w-[18%] px-6 py-3">Assigned</th>
                  <th className="w-[10%] px-6 py-3">Deleted At</th>
                  <th className="w-[10%] px-6 py-3">Created At</th>
                  <th className="w-[8%] px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice(0, 50).map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        checked={selectedLeads.has(l.id)}
                        onChange={() => toggleLeadSelection(l.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 break-words">
                      {l.name || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700 break-words">
                      <div className="font-semibold text-slate-900">
                        {l.number || l.normalizedNumber || "—"}
                      </div>
                      {l.normalizedNumber ? (
                        <div className="mt-0.5 text-xs font-semibold text-slate-500">
                          {l.normalizedNumber}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-slate-700 break-words">
                      {l.location || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700 break-words">
                      {normalizeSourceName(l.source) || "—"}
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
                      {l.deletedAt ? l.deletedAt.toLocaleString() : "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {l.createdAt ? l.createdAt.toLocaleString() : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRestoreLead(l.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600 shadow-sm transition-colors hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-200"
                          title="Restore lead"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(l.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow-sm transition-colors hover:border-red-500 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-200"
                          title="Permanently delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td
                      className="px-6 py-8 text-center text-sm font-semibold text-slate-500"
                      colSpan={9}
                    >
                      No deleted leads found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 50 ? (
            <div className="border-t border-slate-100 px-6 py-3 text-xs font-semibold text-slate-500">
              Showing 50 of {filtered.length} records (use search to narrow).
            </div>
          ) : null}
        </div>
      </div>

      {/* Clear Trash Confirmation Dialog */}
      {clearTrashConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Clear Trash</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-6">
                Are you sure you want to permanently delete all {filtered.length} leads from the recycle bin? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setClearTrashConfirm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearTrash}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Clear Trash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
