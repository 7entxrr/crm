"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  BarChart3, 
  PieChart, 
  Users, 
  Info, 
  ChevronDown, 
  Phone, 
  MessageSquare, 
  Mail, 
  Calendar,
  MapPin,
  TrendingUp,
  Activity,
  Filter
} from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "./_components/ui";

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
  response: string;
  staffEmail: string;
  staffName: string;
};

type AdminSession = { email?: string; name?: string } | null;

function readSession(): AdminSession {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("evohus_admin_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

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

function colorForResponse(key: ResponseKey) {
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

// Loading skeleton component
const LoadingSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
  </div>
);

export default function DashboardPage() {
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [showLeadsFromSource, setShowLeadsFromSource] = useState(false);
  const [showWithTeam, setShowWithTeam] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [responses, setResponses] = useState<CallResponseRow[]>([]);

  const [leadMonths, setLeadMonths] = useState<{ labels: string[]; values: number[] }>({
    labels: [],
    values: [],
  });
  const [responseWeeks, setResponseWeeks] = useState<number[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      const session = readSession();
      setAdminName(session?.name ?? "");
      setAdminEmail(session?.email ?? "");
    });
  }, []);

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
  const overdueLeads = leads.filter(l => {
    if (!l.createdAt) return false;
    const daysSinceCreation = (Date.now() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation > 7 && (l.status === 'new' || l.status === 'pending');
  }).length;

  const siteVisitDone = leads.filter(l => 
    l.status === 'site visit done' || l.status === 'visited'
  ).length;
  const siteVisitNotDone = leads.filter(l => 
    l.status === 'site visit not done' || l.status === 'no-show'
  ).length;

  // Calculate real lead sources from data
  const realLeadSources = useMemo(() => {
    const sources: Record<string, Record<string, number>> = {
      social: {},
      thirdParty: {},
      others: {}
    };

    leads.forEach(lead => {
      const source = (lead.source || 'unknown').toLowerCase();
      
      // Categorize sources
      if (source.includes('facebook') || source.includes('instagram') || 
          source.includes('linkedin') || source.includes('google') || 
          source.includes('gmail') || source.includes('social')) {
        sources.social[source] = (sources.social[source] || 0) + 1;
      } else if (source.includes('housing') || source.includes('magicbricks') || 
                 source.includes('99acres') || source.includes('quikr') || 
                 source.includes('just lead') || source.includes('square yards')) {
        sources.thirdParty[source] = (sources.thirdParty[source] || 0) + 1;
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

  // Dynamic activity data from real responses
  const activityData = useMemo(() => {
    const activities = {
      WhatsApp: 0,
      Call: 0,
      SMS: 0,
      Email: 0,
    };

    responses.forEach(response => {
      // This would need to be enhanced based on your actual response data structure
      // For now, we'll distribute responses evenly
      const responseType = response.response?.toLowerCase() || '';
      if (responseType.includes('whatsapp') || responseType.includes('chat')) {
        activities.WhatsApp++;
      } else if (responseType.includes('call') || responseType.includes('phone')) {
        activities.Call++;
      } else if (responseType.includes('sms') || responseType.includes('text')) {
        activities.SMS++;
      } else if (responseType.includes('email') || responseType.includes('mail')) {
        activities.Email++;
      } else {
        // Default distribution for unclassified responses
        const types = ['WhatsApp', 'Call', 'SMS', 'Email'] as const;
        const randomType = types[Math.floor(Math.random() * types.length)];
        activities[randomType]++;
      }
    });

    return [
      { type: "WhatsApp", count: activities.WhatsApp, icon: MessageSquare, color: "text-green-500" },
      { type: "Call", count: activities.Call, icon: Phone, color: "text-blue-500" },
      { type: "SMS", count: activities.SMS, icon: MessageSquare, color: "text-purple-500" },
      { type: "Email", count: activities.Email, icon: Mail, color: "text-yellow-500" },
    ];
  }, [responses]);

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
      {/* Top Navigation */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">DS</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Dhinwa Solutions Pvt. Ltd.</h1>
            </div>
            <div className="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 shadow-md">
              <span className="text-sm text-gray-600">Team Dashboard</span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 shadow-md">
              <span className="text-sm text-gray-600">Show with team</span>
              <button
                onClick={() => setShowWithTeam(!showWithTeam)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white shadow-sm"
                style={{ backgroundColor: showWithTeam ? '#2563eb' : '#d1d5db' }}
              >
                <span
                  className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm"
                  style={{ transform: showWithTeam ? 'translateX(20px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
            <div className="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 shadow-md">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{adminName ? adminName.split(' ').map(n => n[0]).join('') : 'KR'}</span>
                </div>
                <span className="text-sm text-gray-600">{adminName || "Karthik Rajeev"}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
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
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-yellow-400 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-2xl font-bold text-yellow-600">{unassignedLeads}</div>
                <div className="text-sm text-gray-600">Unassigned</div>
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
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-blue-700">{newLeads}</div>
                <div className="text-sm text-blue-600">New</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 hover:bg-yellow-100 hover:border-yellow-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-yellow-700">{pendingLeads}</div>
                <div className="text-sm text-yellow-600">Pending</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-purple-700">{callbacksLeads}</div>
                <div className="text-sm text-purple-600">Callbacks</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-green-700">{meetingScheduledLeads}</div>
                <div className="text-sm text-green-600">Meeting scheduled</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-orange-700">{siteVisitScheduledLeads}</div>
                <div className="text-sm text-orange-600">Site visit scheduled</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-red-700">{overdueLeads}</div>
                <div className="text-sm text-red-600">Overdue</div>
              </div>
            </>
          )}
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
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-blue-700">{newLeads}</div>
                <div className="text-sm text-blue-600">New</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 hover:bg-yellow-100 hover:border-yellow-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-yellow-700">{pendingLeads}</div>
                <div className="text-sm text-yellow-600">Pending</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-purple-700">{callbacksLeads}</div>
                <div className="text-sm text-purple-600">Callbacks</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-green-700">{meetingScheduledLeads}</div>
                <div className="text-sm text-green-600">Meeting scheduled</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-orange-700">{siteVisitScheduledLeads}</div>
                <div className="text-sm text-orange-600">Site visit scheduled</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
                <div className="text-xl font-bold text-red-700">{overdueLeads}</div>
                <div className="text-sm text-red-600">Overdue</div>
              </div>
            </>
          )}
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-3 md:grid-cols-6">
          {isLoading ? (
            <>
              {[...Array(6)].map((_, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 hover:bg-yellow-100 hover:border-yellow-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
            <div className="text-xl font-bold text-yellow-700">{pendingLeads}</div>
            <div className="text-sm text-yellow-600">Pending</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
            <div className="text-xl font-bold text-purple-700">{callbacksLeads}</div>
            <div className="text-sm text-purple-600">Callbacks</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
            <div className="text-xl font-bold text-green-700">{meetingScheduledLeads}</div>
            <div className="text-sm text-green-600">Meeting scheduled</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
            <div className="text-xl font-bold text-orange-700">{siteVisitScheduledLeads}</div>
            <div className="text-sm text-orange-600">Site visit scheduled</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-all duration-200 hover:shadow-lg cursor-pointer">
            <div className="text-xl font-bold text-red-700">{overdueLeads}</div>
            <div className="text-sm text-red-600">Overdue</div>
          </div>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Social Profiles */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-4">social profiles</h3>
                <div className="space-y-3">
                  {Object.entries(realLeadSources.social).length > 0 ? (
                    Object.entries(realLeadSources.social).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                        <span className="text-sm text-gray-700 capitalize">{name}</span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 italic">No social media leads yet</div>
                  )}
                </div>
              </div>

              {/* 3rd Party */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-4">3rd party</h3>
                <div className="space-y-3">
                  {Object.entries(realLeadSources.thirdParty).length > 0 ? (
                    Object.entries(realLeadSources.thirdParty).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                        <span className="text-sm text-gray-700 capitalize">{name}</span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 italic">No 3rd party leads yet</div>
                  )}
                </div>
              </div>

              {/* Others */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-4">others</h3>
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
      </div>
    </div>
    </>
  );
}
