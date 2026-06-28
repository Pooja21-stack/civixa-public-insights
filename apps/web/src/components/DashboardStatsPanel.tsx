"use client";

import { useEffect, useState } from "react";
import { fetchDashboardStats } from "@/lib/api-mock";
import { DashboardStats } from "@/types";
import { StatCard, Spinner } from "@/components/ui";
import { THEME_LABELS, THEME_COLORS } from "@/lib/constants";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export default function DashboardStatsPanel() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetchDashboardStats().then(setStats);
  }, []);

  if (!stats) return <div className="flex justify-center py-10"><Spinner /></div>;

  const chartData = stats.top_themes.map((t) => ({
    name: THEME_LABELS[t.theme].split(" ")[0], // short label
    count: t.count,
    theme: t.theme,
  }));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Submissions"
          value={stats.total_submissions}
          sub={`+${stats.submissions_today} today`}
          accent
        />
        <StatCard label="Wards Covered"    value={stats.wards_covered} />
        <StatCard label="Priority Projects" value={stats.top_projects.length} />
        <StatCard
          label="Top Theme"
          value={THEME_LABELS[stats.top_themes[0].theme].split(" ")[0]}
          sub={`${stats.top_themes[0].count} submissions`}
        />
      </div>

      {/* Theme bar chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Submissions by Theme</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={32}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.theme} fill={THEME_COLORS[entry.theme]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
