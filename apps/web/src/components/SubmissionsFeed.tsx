"use client";

import { useEffect, useState } from "react";
import { fetchSubmissions } from "@/lib/api-mock";
import { Submission } from "@/types";
import { ThemeBadge, UrgencyBadge, ChannelIcon, Spinner, EmptyState } from "@/components/ui";
import { MOCK_WARDS, MOCK_THEMES } from "@/lib/mock-data";

export default function SubmissionsFeed() {
  const [items, setItems]       = useState<Submission[]>([]);
  const [loading, setLoading]   = useState(true);
  const [themeFilter, setTheme] = useState<string>("");
  const [wardFilter, setWard]   = useState<string>("");

  useEffect(() => {
    setLoading(true);
    fetchSubmissions({
      theme:   themeFilter  || undefined,
      ward_id: wardFilter   || undefined,
    }).then(({ items }) => {
      setItems(items);
      setLoading(false);
    });
  }, [themeFilter, wardFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={themeFilter}
          onChange={(e) => setTheme(e.target.value)}
          className="flex-1 min-w-[140px] border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white hover:border-gray-300"
        >
          <option value="">🏷️ All themes</option>
          {MOCK_THEMES.map((t) => (
            <option key={t.key} value={t.key}>{t.name}</option>
          ))}
        </select>

        <select
          value={wardFilter}
          onChange={(e) => setWard(e.target.value)}
          className="flex-1 min-w-[140px] border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white hover:border-gray-300"
        >
          <option value="">📍 All wards</option>
          {MOCK_WARDS.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Spinner />
          <p className="text-sm text-gray-500">Loading submissions...</p>
        </div>
      ) : !items.length ? (
        <EmptyState message="No submissions match this filter." />
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {items.map((s, idx) => (
            <div
              key={s.id}
              className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl p-4 space-y-3 hover:border-primary-200 hover:shadow-soft transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-gray-800 leading-relaxed flex-1">
                  {s.text_translated || s.text_raw}
                </p>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <UrgencyBadge level={s.urgency_level} />
                  <ChannelIcon channel={s.channel} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {s.themes.map((t) => <ThemeBadge key={t} theme={t} />)}
                {s.ward_name && (
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full font-medium">
                    📍 {s.ward_name}
                  </span>
                )}
                {s.lang !== "en" && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold border border-purple-200">
                    🌐 {s.lang.toUpperCase()} → EN
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto font-medium">
                  {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
