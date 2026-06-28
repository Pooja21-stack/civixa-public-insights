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
      <div className="flex flex-wrap gap-3">
        <select
          value={themeFilter}
          onChange={(e) => setTheme(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All themes</option>
          {MOCK_THEMES.map((t) => (
            <option key={t.key} value={t.key}>{t.name}</option>
          ))}
        </select>

        <select
          value={wardFilter}
          onChange={(e) => setWard(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All wards</option>
          {MOCK_WARDS.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : !items.length ? (
        <EmptyState message="No submissions match this filter." />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-gray-800 leading-relaxed flex-1">
                  {s.text_translated || s.text_raw}
                </p>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <UrgencyBadge level={s.urgency_level} />
                  <ChannelIcon channel={s.channel} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {s.themes.map((t) => <ThemeBadge key={t} theme={t} />)}
                {s.ward_name && (
                  <span className="text-xs text-gray-400">{s.ward_name}</span>
                )}
                {s.lang !== "en" && (
                  <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                    {s.lang.toUpperCase()} → EN
                  </span>
                )}
                <span className="text-xs text-gray-300 ml-auto">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
