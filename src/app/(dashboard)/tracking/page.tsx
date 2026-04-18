import { Activity, CheckCircle2, Clock, MapPin } from "lucide-react";
import { Card } from "../_components/ui";

const timeline = [
  {
    title: "Lead replied",
    meta: "Ocean View Apartment • 10:24 AM",
    tone: "bg-emerald-500/10 text-emerald-700",
  },
  {
    title: "Viewing confirmed",
    meta: "Skyline Towers • 1:15 PM",
    tone: "bg-blue-500/10 text-blue-700",
  },
  {
    title: "Invoice generated",
    meta: "Palm Residency • 3:02 PM",
    tone: "bg-amber-500/10 text-amber-700",
  },
  {
    title: "Deal moved to proposal",
    meta: "Greenfield Villa • 5:48 PM",
    tone: "bg-slate-900/10 text-slate-700",
  },
];

const tasks = [
  { label: "Call 3 qualified leads", due: "Today", done: false },
  { label: "Send property brochure", due: "Today", done: true },
  { label: "Prepare proposal draft", due: "Tomorrow", done: false },
  { label: "Schedule 2 viewings", due: "This week", done: false },
];

export default function TrackingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Tracking</div>
          <div className="mt-1 text-sm text-slate-500">
            Monitor daily activity, tasks, and follow-ups.
          </div>
        </div>
        <button className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0b1220] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-200">
          Create Task
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">28</div>
              <div className="mt-1 text-xs text-slate-500">Events Today</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Activity size={18} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">6</div>
              <div className="mt-1 text-xs text-slate-500">Overdue Tasks</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/10 text-rose-600">
              <Clock size={18} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between p-5">
            <div>
              <div className="text-xl font-semibold">12</div>
              <div className="mt-1 text-xs text-slate-500">Viewings This Week</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
              <MapPin size={18} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between px-6 pt-6">
            <div>
              <div className="text-sm font-semibold">Activity Timeline</div>
              <div className="mt-1 text-xs text-slate-500">
                Recent events across your workspace.
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Today
            </div>
          </div>
          <div className="px-6 pb-6 pt-4">
            <div className="space-y-3">
              {timeline.map((t) => (
                <div
                  key={t.title}
                  className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                  <div
                    className={[
                      "grid h-10 w-10 place-items-center rounded-2xl",
                      t.tone,
                    ].join(" ")}
                  >
                    <Activity size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{t.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{t.meta}</div>
                  </div>
                  <button className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">Task List</div>
                <div className="mt-1 text-xs text-slate-500">
                  Stay on track with daily priorities.
                </div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 size={18} />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.label}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                  <div
                    className={[
                      "mt-0.5 grid h-5 w-5 place-items-center rounded-md border",
                      task.done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 bg-white text-transparent",
                    ].join(" ")}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M20 6 9 17l-5-5"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">
                      {task.label}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Due: {task.due}
                    </div>
                  </div>
                  <button className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    Open
                  </button>
                </div>
              ))}
            </div>

            <button className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200">
              Mark Today Complete
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

