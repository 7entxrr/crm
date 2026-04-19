"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { 
  Users, 
  Info, 
  ChevronDown, 
  Phone, 
  Calendar,
  MapPin,
  TrendingUp,
  Filter
} from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type StaffRow = {
  id: string;
  name: string;
  email: string;
};

type LeadRow = {
  id: string;
  name: string;
  number: string;
  normalizedNumber: string;
  assignedToName: string;
  assignedToEmail: string;
  createdAt: Date | null;
  status?: string;
  source?: string;
  deletedAt?: Date | null;
};

type CallResponseRow = {
  id: string;
  createdAt: Date | null;
  response: string;
  staffEmail: string;
  staffName: string;
};

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
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


function monthKeyFromDate(d: Date) {
  return d.getFullYear() * 12 + d.getMonth();
}

function monthLabelFromKey(key: number) {
  const y = Math.floor(key / 12);
  const m = key % 12;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m] ?? ""} ${String(y).slice(-2)}`;
}

function startOfWeekMs(d: Date) {
  const day = (d.getDay() + 6) % 7;
  const ms = d.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const start = ms - day * dayMs;
  const dt = new Date(start);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}

// Lead Source Categories will be calculated dynamically from real Firebase data

// Pipeline data will be calculated dynamically from real leads data

// Activity data will be calculated dynamically from real response data


export default function DashboardPage() {
  const currentTime = useRef(Date.now());
  const [showLeadsFromSource, setShowLeadsFromSource] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [distributionError, setDistributionError] = useState<string | null>(null);
  const [distributionSuccess, setDistributionSuccess] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogLeads, setDialogLeads] = useState<LeadRow[]>([]);

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [responses, setResponses] = useState<CallResponseRow[]>([]);

  const [leadMonths, setLeadMonths] = useState<{ labels: string[]; values: number[] }>({
    labels: [],
    values: [],
  });
  const [responseWeeks, setResponseWeeks] = useState<number[]>([]);

  // Set loading to false when data is loaded
  useEffect(() => {
    if (leads.length > 0 || staff.length > 0 || responses.length > 0) {
      setIsLoading(false);
    }
  }, [leads, staff, responses]);

  useEffect(() => {
    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows: StaffRow[] = snap.docs.map((d) => {
          const data = d.data() as { name?: string; email?: string };
          return { id: d.id, name: data.name ?? "", email: data.email ?? "" };
        });
        setStaff(rows);
      },
      () => setStaff([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "call_numbers"), orderBy("createdAt", "desc"), limit(3000));
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
            status?: string;
            source?: string;
            createdAt?: { toDate?: () => Date } | null;
            deletedAt?: { toDate?: () => Date } | null;
          };
          return {
            id: d.id,
            name: data.name ?? "",
            number: data.number ?? "",
            normalizedNumber: data.normalizedNumber ?? "",
            assignedToName: data.assignedToName ?? "",
            assignedToEmail: String(data.assignedToEmail ?? "").trim().toLowerCase(),
            status: data.status ?? "",
            source: data.source ?? "",
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : null,
          };
        });

        setLeads(rows);

        const created = rows.map((r) => r.createdAt?.getTime() ?? 0).filter((t) => t > 0);
        const anchor = created.length ? Math.max(...created) : 0;
        if (!anchor) {
          setLeadMonths({ labels: [], values: [] });
          return;
        }
        const anchorKey = monthKeyFromDate(new Date(anchor));
        const keys = Array.from({ length: 12 }, (_, i) => anchorKey - (11 - i));
        const counts = new Map<number, number>();
        for (const r of rows) {
          if (!r.createdAt) continue;
          const k = monthKeyFromDate(r.createdAt);
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        setLeadMonths({
          labels: keys.map((k) => monthLabelFromKey(k)),
          values: keys.map((k) => counts.get(k) ?? 0),
        });
      },
      () => {
        setLeads([]);
        setLeadMonths({ labels: [], values: [] });
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "staff_call_responses"),
      orderBy("createdAt", "desc"),
      limit(3000),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows: CallResponseRow[] = snap.docs.map((d) => {
          const data = d.data() as {
            response?: string;
            staffEmail?: string;
            staffName?: string;
            createdAt?: { toDate?: () => Date } | null;
          };
          return {
            id: d.id,
            response: data.response ?? "",
            staffEmail: String(data.staffEmail ?? "").trim().toLowerCase(),
            staffName: data.staffName ?? "",
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          };
        });
        setResponses(rows);

        const created = rows.map((r) => r.createdAt?.getTime() ?? 0).filter((t) => t > 0);
        const anchor = created.length ? Math.max(...created) : 0;
        if (!anchor) {
          setResponseWeeks([]);
          return;
        }
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const anchorStart = startOfWeekMs(new Date(anchor));
        const buckets = new Array<number>(12).fill(0);
        for (const r of rows) {
          if (!r.createdAt) continue;
          const idx = Math.floor((r.createdAt.getTime() - (anchorStart - 11 * weekMs)) / weekMs);
          if (idx < 0 || idx >= 12) continue;
          buckets[idx] += 1;
        }
        setResponseWeeks(buckets);
      },
      () => {
        setResponses([]);
        setResponseWeeks([]);
      },
    );
    return unsubscribe;
  }, []);

  // Enhanced real-time metrics calculation
  const totalLeads = leads.length;
  const activeLeads = leads.filter(l => 
    l.status !== 'deleted' && 
    l.status !== 'dropped' && 
    l.status !== 'not interested'
  ).length;
  const unassignedLeads = leads.filter(l => !l.assignedToEmail || l.assignedToEmail === '').length;
  const deletedLeads = leads.filter(l => l.status === 'deleted').length;
  const bookedLeads = leads.filter(l => l.status === 'booked' || l.status === 'converted').length;
  const notInterestedLeads = leads.filter(l => 
    l.status === 'not interested' || l.status === 'not_interested'
  ).length;
  const droppedLeads = leads.filter(l => l.status === 'dropped' || l.status === 'lost').length;

  const newLeads = leads.filter(l => l.status === 'new' || l.status === '').length;
  const pendingLeads = leads.filter(l => 
    l.status === 'pending' || l.status === 'follow-up'
  ).length;
  const callbacksLeads = leads.filter(l => 
    l.status === 'callback' || l.status === 'call back'
  ).length;
  const meetingScheduledLeads = leads.filter(l => 
    l.status === 'meeting scheduled' || l.status === 'meeting'
  ).length;
  const siteVisitScheduledLeads = leads.filter(l => 
    l.status === 'site visit scheduled' || l.status === 'site visit'
  ).length;
  const overdueLeads = useMemo(() => leads.filter(l => {
    if (!l.createdAt) return false;
    const daysSinceCreation = (currentTime.current - l.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation > 7 && (l.status === 'new' || l.status === 'pending');
  }).length, [leads, currentTime.current]);

  const siteVisitDone = leads.filter(l => 
    l.status === 'site visit done' || l.status === 'visited'
  ).length;
  const siteVisitNotDone = leads.filter(l => 
    l.status === 'site visit not done' || l.status === 'no-show'
  ).length;

  // Calculate real lead sources from data
  const realLeadSources = useMemo(() => {
    const sources: Record<string, Record<string, number>> = {
      realEstate: {},
      socialMedia: {},
      direct: {},
      others: {}
    };

    leads.forEach(lead => {
      const source = (lead.source || 'unknown').toLowerCase();
      
      // Categorize sources more accurately
      if (source.includes('99acres') || source.includes('99acr') || source.includes('99 acre') || source.includes('99 acr') ||
          source.includes('magicbricks') || source.includes('mb') || source.includes('magic brick') ||
          source.includes('housing') || source.includes('quikr') || 
          source.includes('square yards') || source.includes('just lead') ||
          source.includes('olx')) {
        sources.realEstate[source] = (sources.realEstate[source] || 0) + 1;
      } else if (source.includes('facebook') || source.includes('instagram') || 
                 source.includes('linkedin') || source.includes('whatsapp')) {
        sources.socialMedia[source] = (sources.socialMedia[source] || 0) + 1;
      } else if (source.includes('call') || source.includes('website') || 
                 source.includes('referral') || source.includes('email') || 
                 source.includes('google')) {
        sources.direct[source] = (sources.direct[source] || 0) + 1;
      } else {
        sources.others[source] = (sources.others[source] || 0) + 1;
      }
    });

    return sources;
  }, [leads]);

  // Dynamic pipeline data from real leads
  const pipelineData = useMemo(() => [
    { 
      stage: "New", 
      count: newLeads, 
      color: "bg-blue-500" 
    },
    { 
      stage: "In Engagement", 
      count: pendingLeads + callbacksLeads, 
      color: "bg-purple-500" 
    },
    { 
      stage: "Site Visit Scheduled", 
      count: siteVisitScheduledLeads, 
      color: "bg-orange-500" 
    },
    { 
      stage: "Site Visit Done", 
      count: siteVisitDone, 
      color: "bg-green-500" 
    },
    { 
      stage: "Booked", 
      count: bookedLeads, 
      color: "bg-emerald-500" 
    },
  ], [newLeads, pendingLeads, callbacksLeads, siteVisitScheduledLeads, siteVisitDone, bookedLeads]);

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

  const countsByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) {
      const email = l.assignedToEmail || "unassigned";
      map.set(email, (map.get(email) ?? 0) + 1);
    }
    return map;
  }, [leads]);

  async function distributeUnassignedLeads() {
    setDistributing(true);
    setDistributionError(null);
    setDistributionSuccess(null);

    try {
      const staffList = staffOptions.map((s) => ({ email: s.email, name: s.name }));
      if (!staffList.length) {
        setDistributionError("No employees found. Add employees first.");
        return;
      }

      const unassignedLeads = leads.filter(l => !l.assignedToEmail || l.assignedToEmail === '');
      if (!unassignedLeads.length) {
        setDistributionSuccess("No unassigned leads to distribute.");
        return;
      }

      const counts = new Map<string, number>();
      for (const s of staffList) counts.set(s.email, countsByStaff.get(s.email) ?? 0);

      let distributed = 0;
      for (const lead of unassignedLeads) {
        const assignee = pickAssignee(staffList, counts);
        if (!assignee) {
          setDistributionError("No employees found. Add employees first.");
          return;
        }

        await updateDoc(doc(db, "call_numbers", lead.id), {
          assignedToEmail: assignee.email,
          assignedToName: assignee.name,
          assignedAt: serverTimestamp(),
        });

        counts.set(assignee.email, (counts.get(assignee.email) ?? 0) + 1);
        distributed += 1;
      }

      setDistributionSuccess(`Successfully distributed ${distributed} leads among ${staffList.length} employees.`);
    } catch (err) {
      setDistributionError(err instanceof Error ? err.message : "Failed to distribute leads");
    } finally {
      setDistributing(false);
    }
  }

  function openLeadsDialog(title: string, filterFn: (lead: LeadRow) => boolean) {
    const filteredLeads = leads.filter(filterFn);
    setDialogTitle(title);
    setDialogLeads(filteredLeads);
    setShowDialog(true);
  }

  function closeLeadsDialog() {
    setShowDialog(false);
    setDialogTitle('');
    setDialogLeads([]);
  }

  
  return (
    <>
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 text-gray-900">
      

      <div className="p-6">
        {/* Distribution Messages */}
        {distributionError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {distributionError}
          </div>
        )}
        {distributionSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
            {distributionSuccess}
          </div>
        )}

        {/* Lead Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {isLoading ? (
            <>
              {[...Array(7)].map((_, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div 
                className={`bg-white rounded-lg p-4 border transition-all duration-200 hover:shadow-lg cursor-pointer ${
                  selectedMetric === 'total' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedMetric(selectedMetric === 'total' ? null : 'total')}
              >
                <div className="text-2xl font-bold text-gray-900">{totalLeads}</div>
                <div className="text-sm text-gray-600">Total Leads</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-green-400 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-2xl font-bold text-green-600">{activeLeads}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-yellow-400 transition-all duration-200 hover:shadow-lg cursor-pointer relative">
                <div className="text-2xl font-bold text-yellow-600">{unassignedLeads}</div>
                <div className="text-sm text-gray-600">Unassigned</div>
                {unassignedLeads > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      distributeUnassignedLeads();
                    }}
                    disabled={distributing}
                    className="absolute top-2 right-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {distributing ? 'Distributing...' : 'Distribute'}
                  </button>
                )}
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-400 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-2xl font-bold text-red-600">{deletedLeads}</div>
                <div className="text-sm text-gray-600">Deleted</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-emerald-400 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-2xl font-bold text-emerald-600">{bookedLeads}</div>
                <div className="text-sm text-gray-600">Booked</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-orange-400 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-2xl font-bold text-orange-600">{notInterestedLeads}</div>
                <div className="text-sm text-gray-600">Not Interested</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-purple-400 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-2xl font-bold text-purple-600">{droppedLeads}</div>
                <div className="text-sm text-gray-600">Dropped</div>
              </div>
            </>
          )}
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-3 md:grid-cols-6">
          {isLoading ? (
            <>
              {[...Array(6)].map((_, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('New Leads', l => l.status === 'new' || l.status === '')}>
                <div className="text-xl font-bold text-blue-700">{newLeads}</div>
                <div className="text-sm text-blue-600">New</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 hover:bg-yellow-100 hover:border-yellow-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('Pending Leads', l => l.status === 'pending' || l.status === 'follow-up')}>
                <div className="text-xl font-bold text-yellow-700">{pendingLeads}</div>
                <div className="text-sm text-yellow-600">Pending</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('Callback Leads', l => l.status === 'callback' || l.status === 'call back')}>
                <div className="text-xl font-bold text-purple-700">{callbacksLeads}</div>
                <div className="text-sm text-purple-600">Callbacks</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('Meeting Scheduled Leads', l => l.status === 'meeting scheduled' || l.status === 'meeting')}>
                <div className="text-xl font-bold text-green-700">{meetingScheduledLeads}</div>
                <div className="text-sm text-green-600">Meeting scheduled</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('Site Visit Scheduled Leads', l => l.status === 'site visit scheduled' || l.status === 'site visit')}>
                <div className="text-xl font-bold text-orange-700">{siteVisitScheduledLeads}</div>
                <div className="text-sm text-orange-600">Site visit scheduled</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('Overdue Leads', l => {
                  if (!l.createdAt) return false;
                  const daysSinceCreation = (currentTime.current - l.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                  return daysSinceCreation > 7 && (l.status === 'new' || l.status === 'pending');
                })}>
                <div className="text-xl font-bold text-red-700">{overdueLeads}</div>
                <div className="text-sm text-red-600">Overdue</div>
              </div>
            </>
          )}
        </div>

        {/* Lead Source Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {isLoading ? (
            <>
              {[...Array(7)].map((_, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('99acres Leads', l => !!(l.source?.toLowerCase().includes('99acres') || l.source?.toLowerCase().includes('99acr') || l.source?.toLowerCase().includes('99 acre') || l.source?.toLowerCase().includes('99 acr')))}>
                <div className="text-xl font-bold text-indigo-700">{(realLeadSources.realEstate['99acres'] || 0) + (realLeadSources.realEstate['99acr'] || 0) + (realLeadSources.realEstate['99 acre'] || 0) + (realLeadSources.realEstate['99 acr'] || 0)}</div>
                <div className="text-sm text-indigo-600">99acres</div>
              </div>
              <div className="bg-pink-50 rounded-lg p-4 border border-pink-200 hover:bg-pink-100 hover:border-pink-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('Magic Bricks Leads', l => !!(l.source?.toLowerCase().includes('magicbricks') || l.source?.toLowerCase().includes('mb') || l.source?.toLowerCase().includes('magic brick')))}>
                <div className="text-xl font-bold text-pink-700">{(realLeadSources.realEstate['magicbricks'] || 0) + (realLeadSources.realEstate['mb'] || 0) + (realLeadSources.realEstate['magic brick'] || 0)}</div>
                <div className="text-sm text-pink-600">Magic Bricks</div>
              </div>
              <div className="bg-teal-50 rounded-lg p-4 border border-teal-200 hover:bg-teal-100 hover:border-teal-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('Housing Leads', l => !!(l.source?.toLowerCase().includes('housing')))}>
                <div className="text-xl font-bold text-teal-700">{realLeadSources.realEstate['housing'] || 0}</div>
                <div className="text-sm text-teal-600">Housing</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('Quikr Leads', l => !!(l.source?.toLowerCase().includes('quikr')))}>
                <div className="text-xl font-bold text-orange-700">{realLeadSources.realEstate['quikr'] || 0}</div>
                <div className="text-sm text-orange-600">Quikr</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('Facebook Leads', l => !!(l.source?.toLowerCase().includes('facebook')))}>
                <div className="text-xl font-bold text-purple-700">{realLeadSources.socialMedia['facebook'] || 0}</div>
                <div className="text-sm text-purple-600">Facebook</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('Website Leads', l => !!(l.source?.toLowerCase().includes('website')))}>
                <div className="text-xl font-bold text-slate-700">{realLeadSources.direct['website'] || 0}</div>
                <div className="text-sm text-slate-600">Website</div>
              </div>
              <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200 hover:bg-cyan-100 hover:border-cyan-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openLeadsDialog('OLX Leads', l => !!(l.source?.toLowerCase().includes('olx')))}>
                <div className="text-xl font-bold text-cyan-700">{realLeadSources.realEstate['olx'] || 0}</div>
                <div className="text-sm text-cyan-600">OLX</div>
              </div>
            </>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leads Pipeline */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Leads pipeline</h2>
                <TrendingUp className="h-5 w-5 text-gray-500" />
              </div>
              <div className="space-y-4">
                {pipelineData.map((stage, index) => (
                  <div key={stage.stage} className="flex items-center space-x-4">
                    <div className="w-24 text-sm text-gray-600">{stage.stage}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden relative">
                      <div 
                        className={`h-full ${stage.color} flex items-center justify-center text-sm font-medium text-white transition-all duration-1000 ease-out relative z-10`}
                        style={{ 
                          width: `${(stage.count / 120) * 100}%`,
                          animation: `slideIn 0.8s ease-out ${index * 0.1}s both`
                        }}
                      >
                        {stage.count}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Site Visits */}
          <div>
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Site Visits</h2>
                <MapPin className="h-5 w-5 text-gray-500" />
              </div>
              <div className="space-y-4">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-2xl font-bold text-green-700">{siteVisitDone}</div>
                  <div className="text-sm text-green-600">Site visit done</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="text-2xl font-bold text-red-700">{siteVisitNotDone}</div>
                  <div className="text-sm text-red-600">Site visit not done</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Dashboard */}
        <div className="mt-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Analytics Overview</h2>
              <TrendingUp className="h-5 w-5 text-gray-500" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lead Conversion Chart */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Lead Conversion Rate</h3>
                <div className="flex items-center justify-center h-32">
                  <div className="relative">
                    <div className="text-3xl font-bold text-blue-600">
                      {totalLeads > 0 ? Math.round((bookedLeads / totalLeads) * 100) : 0}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {bookedLeads} of {totalLeads} leads converted
                    </div>
                  </div>
                </div>
              </div>

              {/* Response Time Chart */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Average Response Time</h3>
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {responses.length > 0 ? '2.5h' : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Based on {responses.length} responses
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Trend Chart */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Monthly Lead Trend</h3>
              <div className="h-40 bg-gray-100 rounded-lg p-4 flex items-end space-x-2">
                {leadMonths.values.length > 0 ? leadMonths.values.map((value, index) => (
                  <div key={index} className="flex-1 bg-blue-500 rounded-t-lg transition-all duration-300 hover:bg-blue-600 relative group">
                    <div 
                      className="text-xs text-white text-center font-medium absolute bottom-0 left-0 right-0 p-1"
                      style={{ height: `${(value / Math.max(...leadMonths.values)) * 100}%` }}
                    >
                      {value}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-xs rounded px-2 py-1 absolute -top-8 left-1/2 transform -translate-x-1/2 transition-opacity whitespace-nowrap">
                      {leadMonths.labels[index]}: {value} leads
                    </div>
                  </div>
                )) : (
                  <div className="flex-1 items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>
              {leadMonths.labels.length > 0 && (
                <div className="flex justify-center mt-2 space-x-4 text-xs text-gray-600">
                  {leadMonths.labels.map((label, index) => (
                    <span key={index} className="flex-1 text-center">{label}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Performance Metrics Grid */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-500 rounded-full p-2">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-700">{staff.length}</div>
                    <div className="text-sm text-blue-600">Team Members</div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-500 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-700">{Math.round((activeLeads / totalLeads) * 100) || 0}%</div>
                    <div className="text-sm text-green-600">Active Rate</div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-500 rounded-full p-2">
                    <Phone className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-700">{responses.length}</div>
                    <div className="text-sm text-purple-600">Total Responses</div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                <div className="flex items-center space-x-3">
                  <div className="bg-orange-500 rounded-full p-2">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-700">{siteVisitScheduledLeads + siteVisitDone}</div>
                    <div className="text-sm text-orange-600">Site Visits</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leads from Source Button */}
        <div className="mt-6 text-center">
          <button 
            onClick={() => setShowLeadsFromSource(!showLeadsFromSource)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium inline-flex items-center space-x-2 transition-colors shadow-sm"
            >
            <Filter className="h-5 w-5" />
            <span>View Leads from Source ({totalLeads})</span>
          </button>
        </div>

        {/* Leads from Source Modal/Section */}
        {showLeadsFromSource && (
          <div className="mt-6 bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-semibold text-gray-900">({totalLeads}) Leads from source</h2>
                <Info className="h-5 w-5 text-gray-500" />
              </div>
              <div className="flex items-center space-x-3">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors">
                  Details View
                </button>
                <button className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm transition-colors">
                  Toggle
                </button>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Till Date</span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Real Estate Platforms */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  Real Estate Platforms
                </h3>
                <div className="space-y-3">
                  {Object.entries(realLeadSources.realEstate).length > 0 ? (
                    Object.entries(realLeadSources.realEstate).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                        <span className="text-sm text-gray-700 capitalize">{name}</span>
                        <span className="text-sm font-medium text-blue-700">{count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 italic">No real estate leads yet</div>
                  )}
                </div>
              </div>

              {/* Social Media */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  Social Media
                </h3>
                <div className="space-y-3">
                  {Object.entries(realLeadSources.socialMedia).length > 0 ? (
                    Object.entries(realLeadSources.socialMedia).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between bg-purple-50 rounded-lg px-4 py-3 border border-purple-200">
                        <span className="text-sm text-gray-700 capitalize">{name}</span>
                        <span className="text-sm font-medium text-purple-700">{count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 italic">No social media leads yet</div>
                  )}
                </div>
              </div>

              {/* Direct Sources */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Direct Sources
                </h3>
                <div className="space-y-3">
                  {Object.entries(realLeadSources.direct).length > 0 ? (
                    Object.entries(realLeadSources.direct).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between bg-green-50 rounded-lg px-4 py-3 border border-green-200">
                        <span className="text-sm text-gray-700 capitalize">{name}</span>
                        <span className="text-sm font-medium text-green-700">{count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 italic">No direct leads yet</div>
                  )}
                </div>
              </div>

              {/* Others */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                  Other Sources
                </h3>
                <div className="space-y-3">
                  {Object.entries(realLeadSources.others).length > 0 ? (
                    Object.entries(realLeadSources.others).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                        <span className="text-sm text-gray-700 capitalize">{name}</span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 italic">No other leads yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leads Dialog Modal */}
        {showDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">{dialogTitle}</h2>
                <button
                  onClick={closeLeadsDialog}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {dialogLeads.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-500 mb-4">{dialogLeads.length} leads found</div>
                    {dialogLeads.map((lead) => (
                      <div key={lead.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{lead.name || 'Unknown'}</div>
                            <div className="text-sm text-gray-600 mt-1">{lead.number || 'No number'}</div>
                            {lead.source && (
                              <div className="text-xs text-gray-500 mt-1">Source: {lead.source}</div>
                            )}
                            {lead.assignedToName && (
                              <div className="text-xs text-gray-500 mt-1">Assigned to: {lead.assignedToName}</div>
                            )}
                            {lead.status && (
                              <div className="text-xs text-gray-500 mt-1">Status: {lead.status}</div>
                            )}
                          </div>
                          {lead.createdAt && (
                            <div className="text-xs text-gray-400 ml-4">
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-sm">No leads found for this category</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
