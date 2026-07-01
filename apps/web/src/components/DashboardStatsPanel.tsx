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

  const chartData = (stats.top_themes ?? []).map((t) => ({
    name: (THEME_LABELS[t.theme] ?? t.theme).split(" ")[0],
    count: t.count,
    theme: t.theme,
  }));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 rounded-2xl p-5 shadow-soft hover:shadow-soft-lg transition-all card-hover">
          <div className="flex items-start justify-between mb-2">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white text-lg shadow-soft">
              📊
            </div>
            <span className="text-xs font-semibold text-primary-700 bg-primary-200 px-2 py-1 rounded-full">
              +{stats.submissions_today}
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats.total_submissions}</div>
          <div className="text-xs font-medium text-gray-600">Total Submissions</div>
        </div>

        <div className="bg-gradient-to-br from-mint-50 to-mint-100 border-2 border-mint-200 rounded-2xl p-5 shadow-soft hover:shadow-soft-lg transition-all card-hover">
          <div className="flex items-start justify-between mb-2">
            <div className="w-10 h-10 bg-mint-600 rounded-xl flex items-center justify-center text-white text-lg shadow-soft">
              📍
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats.wards_covered}</div>
          <div className="text-xs font-medium text-gray-600">Wards Covered</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-2xl p-5 shadow-soft hover:shadow-soft-lg transition-all card-hover">
          <div className="flex items-start justify-between mb-2">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white text-lg shadow-soft">
              🎯
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats.top_projects.length}</div>
          <div className="text-xs font-medium text-gray-600">Priority Projects</div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100 border-2 border-rose-200 rounded-2xl p-5 shadow-soft hover:shadow-soft-lg transition-all card-hover">
          <div className="flex items-start justify-between mb-2">
            <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white text-lg shadow-soft">
              🏆
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {THEME_LABELS[stats.top_themes[0].theme].split(" ")[0]}
          </div>
          <div className="text-xs font-medium text-gray-600">
            Top Theme · {stats.top_themes[0].count} requests
          </div>
        </div>
      </div>

      {/* Theme bar chart */}
      <div className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-2xl p-6 shadow-soft-lg">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-gradient-to-r from-amber-500 to-rose-500 rounded-lg flex items-center justify-center text-white text-sm shadow-soft">
              📈
            </span>
            Submissions by Theme
          </h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
            Last 30 days
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={40}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "#f1f5f9", radius: 8 }}
              contentStyle={{
                fontSize: 13,
                borderRadius: 12,
                border: "2px solid #e5e7eb",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
              }}
            />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
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
