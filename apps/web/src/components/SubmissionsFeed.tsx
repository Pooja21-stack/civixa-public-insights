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

// Track which submission IDs are showing the English translation (toggled)
export default function SubmissionsFeed() {
  const [items, setItems]         = useState<Submission[]>([]);
  const [loading, setLoading]     = useState(true);
  const [themeFilter, setTheme]   = useState<string>("");
  const [wardFilter, setWard]     = useState<string>("");
  const [expanded, setExpanded]   = useState<string | null>(null);
  // IDs where the user has clicked to see the English translation
  const [translatedIds, setTranslatedIds] = useState<Set<string>>(new Set());

  function toggleTranslation(id: string) {
    setTranslatedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {/* Non-English with translation: toggle between original and translation */}
                    {s.lang && s.lang !== "en" && s.text_translated
                      ? translatedIds.has(s.id)
                        ? s.text_translated   // showing English translation
                        : s.text_raw          // showing original language
                      : s.text_raw || s.text_translated}
                  </p>
                  {/* Language label — shown when no translation is available */}
                  {s.lang && s.lang !== "en" && !s.text_translated && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      🌐 Original · {s.lang.toUpperCase()}
                    </span>
                  )}
                  {/* Audio player — only for voice submissions that have a recording */}
                  {s.channel === "voice" && s.audio_url && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-purple-500 text-sm flex-shrink-0">🎙️</span>
                      <audio
                        controls
                        src={s.audio_url}
                        className="flex-1 h-8"
                        style={{ minWidth: 0 }}
                      />
                    </div>
                  )}
                </div>
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
                {s.lang && s.lang !== "en" && s.text_translated && (
                  <button
                    onClick={() => toggleTranslation(s.id)}
                    title={translatedIds.has(s.id) ? "Show original" : "Translate to English"}
                    className={`text-xs px-2 py-1 rounded-full font-semibold border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                      translatedIds.has(s.id)
                        ? "bg-purple-600 text-white border-purple-700 hover:bg-purple-700"
                        : "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200"
                    }`}
                  >
                    {translatedIds.has(s.id)
                      ? `🌐 EN → ${s.lang.toUpperCase()}`
                      : `🌐 ${s.lang.toUpperCase()} → EN`}
                  </button>
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
