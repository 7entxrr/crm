import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-slate-100/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function IconButton({ children }: { children: ReactNode }) {
  return (
    <button className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-100">
      {children}
    </button>
  );
}

export function MetricTile({
  value,
  label,
  delta,
  deltaTone,
}: {
  value: string;
  label: string;
  delta: string;
  deltaTone: "up" | "down";
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
      <div className="text-xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
      <div
        className={[
          "mt-3 inline-flex items-center gap-1 text-xs font-semibold",
          deltaTone === "up" ? "text-emerald-600" : "text-rose-600",
        ].join(" ")}
      >
        {deltaTone === "up" ? (
          <ArrowUpRight size={14} />
        ) : (
          <ArrowDownRight size={14} />
        )}
        <span>{delta}</span>
      </div>
    </div>
  );
}

export function BarsMini({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-20 items-end gap-2">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-lg bg-gradient-to-t from-blue-600/60 to-blue-400/40 shadow-[0_6px_16px_rgba(37,99,235,0.12)]"
          style={{ height: `${Math.max(12, Math.round((v / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

export function BarsLarge({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="grid h-[260px] grid-cols-12 items-end gap-2">
      {values.map((v, i) => {
        const pct = Math.max(8, Math.round((v / max) * 100));
        return (
          <div key={i} className="flex h-full items-end">
            <div
              className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 transition-transform hover:-translate-y-1"
              style={{ height: `${pct}%` }}
            >
              <div className="h-full w-full rounded-xl bg-[repeating-linear-gradient(135deg,rgba(16,185,129,0.55)_0px,rgba(16,185,129,0.55)_2px,rgba(16,185,129,0.15)_2px,rgba(16,185,129,0.15)_6px)]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({
  segments,
  size,
  strokeWidth,
}: {
  segments: { value: number; color: string; label?: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const s = size ?? 78;
  const sw = strokeWidth ?? 10;
  const cx = s / 2;
  const cy = s / 2;
  const r = Math.max(4, s / 2 - sw / 2 - 2);
  const c = 2 * Math.PI * r;
  const values = segments.map((s) => Math.max(0, s.value));
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  const segLengths = values.map((v) => (c * v) / sum);
  const offsets = segLengths.map((_, i) =>
    i === 0 ? 0 : -segLengths.slice(0, i).reduce((a, b) => a + b, 0),
  );

  return (
    <div className="grid place-items-center">
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(148,163,184,0.25)"
          strokeWidth={sw}
        />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {segments.map((s, i) => {
            const seg = segLengths[i];
            const dash = `${seg} ${Math.max(0, c - seg)}`;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={sw}
                strokeDasharray={dash}
                strokeDashoffset={offsets[i]}
                strokeLinecap="round"
              >
                <title>
                  {(s.label ? `${s.label}: ` : "") + String(Math.max(0, s.value))}
                </title>
              </circle>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export function LineSparkline({ color }: { color: string }) {
  return (
    <svg className="h-20 w-full" viewBox="0 0 240 80" preserveAspectRatio="none">
      <path
        d="M0 58 C 18 40, 34 72, 52 52 S 86 30, 104 46 S 138 78, 156 54 S 190 24, 208 38 S 226 72, 240 44"
        fill="none"
        stroke={color}
        strokeWidth="3"
      />
      <path
        d="M0 58 C 18 40, 34 72, 52 52 S 86 30, 104 46 S 138 78, 156 54 S 190 24, 208 38 S 226 72, 240 44 L 240 80 L 0 80 Z"
        fill={color.replace("0.95", "0.10")}
      />
      <g stroke="rgba(15,23,42,0.06)">
        {[0, 48, 96, 144, 192, 240].map((x) => (
          <line key={x} x1={x} x2={x} y1="0" y2="80" />
        ))}
      </g>
    </svg>
  );
}
