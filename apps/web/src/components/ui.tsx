import { ThemeKey, UrgencyLevel } from "@/types";
import { THEME_BG, THEME_LABELS, URGENCY_COLORS, URGENCY_DOT } from "@/lib/constants";
import { clsx } from "clsx";

// ─── ThemeBadge ───────────────────────────────────────────────────────────────

export function ThemeBadge({ theme }: { theme: ThemeKey }) {
  return (
    <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-semibold", THEME_BG[theme])}>
      {THEME_LABELS[theme]}
    </span>
  );
}

// ─── UrgencyBadge ─────────────────────────────────────────────────────────────

export function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold", URGENCY_COLORS[level])}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", URGENCY_DOT[level])} />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

export function ScoreBar({ score, label }: { score: number; label: string }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-red-500" :
    pct >= 60 ? "bg-orange-400" :
    pct >= 40 ? "bg-yellow-400" : "bg-green-400";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-semibold text-gray-700">{pct}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className={clsx("h-1.5 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── RankBadge ────────────────────────────────────────────────────────────────

export function RankBadge({ rank }: { rank: number }) {
  const colors = [
    "bg-yellow-400 text-yellow-900",
    "bg-gray-300   text-gray-800",
    "bg-amber-600  text-white",
  ];
  const cls = colors[rank - 1] ?? "bg-blue-100 text-blue-800";
  return (
    <span className={clsx("inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold", cls)}>
      #{rank}
    </span>
  );
}

// ─── ChannelIcon ──────────────────────────────────────────────────────────────

export function ChannelIcon({ channel }: { channel: "web" | "whatsapp" | "voice" }) {
  const map = { web: "🌐", whatsapp: "💬", voice: "🎙️" };
  return <span title={channel} className="text-base">{map[channel]}</span>;
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({
  label, value, sub, accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={clsx(
      "rounded-xl border p-5 flex flex-col gap-1",
      accent ? "bg-blue-600 border-blue-700 text-white" : "bg-white border-gray-200"
    )}>
      <p className={clsx("text-xs font-semibold uppercase tracking-wide", accent ? "text-blue-200" : "text-gray-400")}>
        {label}
      </p>
      <p className={clsx("text-3xl font-bold", accent ? "text-white" : "text-gray-900")}>
        {value}
      </p>
      {sub && <p className={clsx("text-xs", accent ? "text-blue-200" : "text-gray-500")}>{sub}</p>}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "h-4 w-4", md: "h-7 w-7", lg: "h-10 w-10" }[size];
  return (
    <div className={clsx("animate-spin rounded-full border-2 border-gray-200 border-t-blue-600", s)} />
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
      <span className="text-4xl">📭</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}
