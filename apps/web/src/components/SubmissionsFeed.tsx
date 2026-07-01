"use client";

import { useEffect, useState } from "react";
import { fetchSubmissions } from "@/lib/api-mock";
import { Submission } from "@/types";
import { ThemeBadge, UrgencyBadge, ChannelIcon, Spinner, EmptyState } from "@/components/ui";
import { MOCK_WARDS, MOCK_THEMES } from "@/lib/mock-data";

// ISO 639-1 code → native language name
const LANG_NAMES: Record<string, string> = {
  hi: "हिंदी",
  gu: "ગુજરાતી",
  ta: "தமிழ்",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  mr: "मराठी",
  bn: "বাংলা",
  pa: "ਪੰਜਾਬੀ",
  ml: "മലയാളം",
  ur: "اردو",
};

function getLangLabel(code: string | undefined): string | null {
  if (!code || code === "en" || code === "string") return null;
  return LANG_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

export default function SubmissionsFeed() {
  const [items, setItems]         = useState<Submission[]>([]);
  const [loading, setLoading]     = useState(true);
  const [themeFilter, setTheme]   = useState<string>("");
  const [wardFilter, setWard]     = useState<string>("");
  const [expanded, setExpanded]   = useState<string | null>(null);

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
          {items.map((s) => {
            const langCode  = s.lang_detected ?? s.lang;
            const langLabel = getLangLabel(langCode);
            const isNonEn   = !!langLabel;
            // Always show the original submission text; English translation shown on expand
            const displayText = s.text_raw;
            const hasTranslation =
              isNonEn &&
              s.text_translated &&
              s.text_translated !== s.text_raw &&
              !s.text_translated.startsWith("[Translated]");
            const isOpen = expanded === s.id;

            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    {/* Original text — always shown */}
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {displayText}
                    </p>
                    {/* English translation — shown inline when expanded */}
                    {hasTranslation && isOpen && (
                      <p className="text-xs text-gray-500 italic leading-relaxed border-l-2 border-purple-200 pl-2">
                        {s.text_translated}
                      </p>
                    )}
                  </div>
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

                  {/* Language badge — shows native script name, not raw code */}
                  {langLabel && (
                    <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                      {langLabel}
                      {hasTranslation && (
                        <button
                          onClick={() => setExpanded(isOpen ? null : s.id)}
                          className="ml-1 opacity-70 hover:opacity-100"
                          title={isOpen ? "Hide translation" : "Show English translation"}
                        >
                          {isOpen ? "▲" : "▼ EN"}
                        </button>
                      )}
                    </span>
                  )}

                  <span className="text-xs text-gray-300 ml-auto">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
