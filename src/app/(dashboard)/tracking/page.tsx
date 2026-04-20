"use client";

import { useEffect, useState, useMemo } from "react";
import { Clock, TrendingUp, Users, Calendar, BarChart3, Search, Smartphone } from "lucide-react";
import { Card, DonutChart } from "../_components/ui";
import {
  collection,
  collectionGroup,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  createdAt?: Date | null;
};

const normalizeAppName = (appName: string): string => {
  return appName === "swaraj_infra" ? "clear_lands" : appName;
};

type ActivitySession = {
  id: string;
  staffEmail: string;
  staffName: string;
  appName: string;
  trackedAt: Date | null;
  usageInMinutes: number;
  usageInSeconds: number;
  date: Date | null;
};

export default function TrackingPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [selectedDateRange, setSelectedDateRange] = useState<string>("today");
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<string>("all");

  useEffect(() => {
    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"), limit(100));
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
      () => {
        setStaff([]);
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collectionGroup(db, "daily_usage"), orderBy("date", "desc"), limit(2000));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const allSessions: ActivitySession[] = [];
        
        snap.docs.forEach((d) => {
          const data = d.data() as {
            staffEmail?: string;
            date?: string;
            appUsageData?: Array<{
              appName?: string;
              trackedAt?: { toDate?: () => Date } | null;
              usageInMinutes?: number;
              usageInSeconds?: number;
            }>;
          };
          
          if (data.appUsageData && data.staffEmail) {
            const staffMember = staff.find(s => s.email === data.staffEmail);
            const staffName = staffMember?.name || data.staffEmail;
            const dateStr = data.date;
            const date = dateStr ? new Date(dateStr) : null;
            
            data.appUsageData.forEach((appUsage, index) => {
              allSessions.push({
                id: `${d.id}-${index}`,
                staffEmail: data.staffEmail!,
                staffName,
                appName: normalizeAppName(appUsage.appName || "Unknown App"),
                trackedAt: appUsage.trackedAt?.toDate ? appUsage.trackedAt.toDate() : null,
                usageInMinutes: appUsage.usageInMinutes || 0,
                usageInSeconds: appUsage.usageInSeconds || 0,
                date,
              });
            });
          }
        });
        
        setSessions(allSessions);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching daily_usage:", error);
        setSessions([]);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [staff]);

  const filteredSessions = useMemo(() => {
    let filtered = sessions;
    
    // Filter by staff
    if (selectedStaff !== "all") {
      filtered = filtered.filter((s) => s.staffEmail === selectedStaff);
    }
    
    // Filter by app
    if (selectedApp !== "all") {
      filtered = filtered.filter((s) => s.appName === selectedApp);
    }
    
    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        s.staffName.toLowerCase().includes(q) ||
        s.appName.toLowerCase().includes(q) ||
        s.staffEmail.toLowerCase().includes(q)
      );
    }
    
    // Filter by date range
    const now = new Date();
    const cutoffDate = new Date();
    if (selectedDateRange === "today") {
      cutoffDate.setHours(0, 0, 0, 0);
      now.setHours(23, 59, 59, 999);
      filtered = filtered.filter((s) => s.date && s.date >= cutoffDate && s.date <= now);
    } else if (selectedDateRange === "7days") {
      cutoffDate.setDate(now.getDate() - 7);
      filtered = filtered.filter((s) => s.date && s.date >= cutoffDate);
    } else if (selectedDateRange === "30days") {
      cutoffDate.setDate(now.getDate() - 30);
      filtered = filtered.filter((s) => s.date && s.date >= cutoffDate);
    } else if (selectedDateRange === "90days") {
      cutoffDate.setDate(now.getDate() - 90);
      filtered = filtered.filter((s) => s.date && s.date >= cutoffDate);
    }
    
    return filtered;
  }, [sessions, selectedStaff, selectedDateRange, search, selectedApp]);

  // Calculate metrics
  const totalSessions = filteredSessions.length;
  const totalDuration = filteredSessions.reduce((sum, s) => sum + s.usageInMinutes, 0);
  const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
  
  // Group by staff
  const staffMetrics = useMemo(() => {
    const metrics = new Map<string, { name: string; sessions: number; duration: number }>();
    
    for (const session of filteredSessions) {
      const existing = metrics.get(session.staffEmail) || { name: session.staffName, sessions: 0, duration: 0 };
      existing.sessions += 1;
      existing.duration += session.usageInMinutes;
      metrics.set(session.staffEmail, existing);
    }
    
    return Array.from(metrics.entries()).map(([email, data]) => ({
      email,
      ...data,
    })).sort((a, b) => b.duration - a.duration);
  }, [filteredSessions]);

  // Group by date
  const dailyMetrics = useMemo(() => {
    const metrics = new Map<string, { date: string; sessions: number; duration: number }>();
    
    for (const session of filteredSessions) {
      if (!session.date) continue;
      const dateStr = session.date.toISOString().split('T')[0];
      const existing = metrics.get(dateStr) || { date: dateStr, sessions: 0, duration: 0 };
      existing.sessions += 1;
      existing.duration += session.usageInMinutes;
      metrics.set(dateStr, existing);
    }
    
    return Array.from(metrics.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSessions]);

  // Group by app
  const appMetrics = useMemo(() => {
    const metrics = new Map<string, { appName: string; sessions: number; duration: number }>();
    
    for (const session of filteredSessions) {
      const normalizedAppName = normalizeAppName(session.appName);
      const existing = metrics.get(normalizedAppName) || { appName: normalizedAppName, sessions: 0, duration: 0 };
      existing.sessions += 1;
      existing.duration += session.usageInMinutes;
      metrics.set(normalizedAppName, existing);
    }
    
    return Array.from(metrics.values()).sort((a, b) => b.duration - a.duration);
  }, [filteredSessions]);

  // Get unique apps for filter
  const uniqueApps = useMemo(() => {
    const apps = new Set(sessions.map(s => normalizeAppName(s.appName)));
    return Array.from(apps).sort();
  }, [sessions]);

  // Hourly usage metrics for heatmap
  const hourlyMetrics = useMemo(() => {
    const metrics = new Map<number, number>();
    
    for (const session of filteredSessions) {
      if (!session.trackedAt) continue;
      const hour = session.trackedAt.getHours();
      const existing = metrics.get(hour) || 0;
      metrics.set(hour, existing + session.usageInMinutes);
    }
    
    return metrics;
  }, [filteredSessions]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Employee Activity Tracking</div>
          <div className="mt-1 text-sm text-slate-500">
            Monitor app usage, session duration, and activity patterns for each employee.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search employees or apps..."
              className="h-10 w-64 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
          <select
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
          >
            <option value="all">All Employees</option>
            {staff.map((s) => (
              <option key={s.email} value={s.email}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
          >
            <option value="all">All Apps</option>
            {uniqueApps.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">{totalSessions}</div>
              <div className="mt-1 text-xs text-slate-500">Total Sessions</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
              <Users size={18} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">{formatDuration(totalDuration)}</div>
              <div className="mt-1 text-xs text-slate-500">Total Time</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Clock size={18} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">{formatDuration(avgDuration)}</div>
              <div className="mt-1 text-xs text-slate-500">Avg Session</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <TrendingUp size={18} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">{staffMetrics.length}</div>
              <div className="mt-1 text-xs text-slate-500">Active Employees</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-500/10 text-purple-600">
              <BarChart3 size={18} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">{appMetrics.length}</div>
              <div className="mt-1 text-xs text-slate-500">Apps Used</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-pink-500/10 text-pink-600">
              <Smartphone size={18} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Staff Usage Chart */}
        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">Employee Usage</div>
                <div className="mt-1 text-xs text-slate-500">
                  Total time spent by each employee
                </div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Users size={18} />
              </div>
            </div>

            {staffMetrics.length > 0 ? (
              <div className="mt-6 space-y-4">
                {staffMetrics.slice(0, 5).map((metric, index) => {
                  const maxDuration = Math.max(...staffMetrics.map(m => m.duration));
                  const percentage = (metric.duration / maxDuration) * 100;
                  
                  return (
                    <div key={metric.email} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium text-slate-900">{metric.name}</div>
                        <div className="text-slate-600">
                          {formatDuration(metric.duration)} ({metric.sessions} sessions)
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 text-center text-sm text-slate-500">
                No activity data available
              </div>
            )}
          </div>
        </Card>

        {/* App Usage Chart */}
        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">App Usage</div>
                <div className="mt-1 text-xs text-slate-500">
                  Most used apps by duration
                </div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-pink-500/10 text-pink-600">
                <Smartphone size={18} />
              </div>
            </div>

            {appMetrics.length > 0 ? (
              <div className="mt-6 space-y-4">
                {appMetrics.slice(0, 5).map((metric, index) => {
                  const maxDuration = Math.max(...appMetrics.map(m => m.duration));
                  const percentage = (metric.duration / maxDuration) * 100;
                  
                  return (
                    <div key={metric.appName} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium text-slate-900">{metric.appName}</div>
                        <div className="text-slate-600">
                          {formatDuration(metric.duration)} ({metric.sessions} sessions)
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-pink-500 to-pink-600 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 text-center text-sm text-slate-500">
                No app data available
              </div>
            )}
          </div>
        </Card>

        {/* Daily Activity Chart */}
        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">Daily Activity</div>
                <div className="mt-1 text-xs text-slate-500">
                  Session activity over time
                </div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
                <Calendar size={18} />
              </div>
            </div>

            {dailyMetrics.length > 0 ? (
              <div className="mt-6 space-y-4">
                {dailyMetrics.slice(-7).map((metric) => {
                  const maxDuration = Math.max(...dailyMetrics.map(m => m.duration));
                  const percentage = (metric.duration / maxDuration) * 100;
                  const date = new Date(metric.date);
                  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  
                  return (
                    <div key={metric.date} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium text-slate-900">{formattedDate}</div>
                        <div className="text-slate-600">
                          {formatDuration(metric.duration)} ({metric.sessions} sessions)
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 text-center text-sm text-slate-500">
                No daily activity data available
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Hourly Usage Heatmap */}
      <Card>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">Hourly Usage Pattern</div>
              <div className="mt-1 text-xs text-slate-500">
                App usage distribution by hour of day
              </div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <Clock size={18} />
            </div>
          </div>

          {hourlyMetrics.size > 0 ? (
            <div className="mt-6">
              <div className="grid grid-cols-12 gap-1">
                {Array.from({ length: 24 }, (_, hour) => {
                  const duration = hourlyMetrics.get(hour) || 0;
                  const maxDuration = Math.max(...hourlyMetrics.values());
                  const intensity = maxDuration > 0 ? duration / maxDuration : 0;
                  
                  return (
                    <div
                      key={hour}
                      className="group relative flex aspect-square items-center justify-center rounded-md"
                      title={`${hour}:00 - ${formatDuration(duration)}`}
                    >
                      <div
                        className="h-full w-full rounded-md transition-all hover:scale-110"
                        style={{
                          backgroundColor: intensity > 0 
                            ? `rgba(16, 185, 129, ${0.2 + intensity * 0.8})`
                            : '#f1f5f9'
                        }}
                      />
                      <span className="absolute text-[10px] font-medium text-white opacity-0 group-hover:opacity-100">
                        {hour}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>11 PM</span>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center text-sm text-slate-500">
              No hourly data available
            </div>
          )}
        </div>
      </Card>

      {/* Employee Cards */}
      <div>
        <div className="mb-4">
          <div className="text-sm font-semibold">Employee Overview</div>
          <div className="mt-1 text-xs text-slate-500">
            Individual statistics for each employee
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staffMetrics.slice(0, 6).map((metric) => {
            const staffMember = staff.find(s => s.email === metric.email);
            const employeeSessions = filteredSessions.filter(s => s.staffEmail === metric.email);
            const avgSessionDuration = employeeSessions.length > 0 
              ? Math.round(metric.duration / employeeSessions.length) 
              : 0;
            
            return (
              <Card key={metric.email} className="hover:shadow-lg transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{metric.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{metric.email}</div>
                    </div>
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-semibold">
                      {metric.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{metric.sessions}</div>
                      <div className="text-xs text-slate-500">Sessions</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{formatDuration(metric.duration)}</div>
                      <div className="text-xs text-slate-500">Total Time</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{formatDuration(avgSessionDuration)}</div>
                      <div className="text-xs text-slate-500">Avg/Session</div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Detailed Session List */}
      <Card>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">Recent Sessions</div>
              <div className="mt-1 text-xs text-slate-500">
                Detailed session history
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 w-[20%]">Employee</th>
                  <th className="px-4 py-3 w-[15%]">Date</th>
                  <th className="px-4 py-3 w-[15%]">App</th>
                  <th className="px-4 py-3 w-[15%]">Tracked At</th>
                  <th className="px-4 py-3 w-[15%]">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.slice(0, 20).map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {session.staffName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {session.date ? session.date.toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {session.appName || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {session.trackedAt ? session.trackedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDuration(session.usageInMinutes)}
                    </td>
                  </tr>
                ))}
                {!loading && filteredSessions.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-sm font-semibold text-slate-500"
                      colSpan={5}
                    >
                      No sessions found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {!loading && filteredSessions.length > 20 && (
            <div className="mt-4 text-xs text-slate-500 text-center">
              Showing 20 of {filteredSessions.length} sessions
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
