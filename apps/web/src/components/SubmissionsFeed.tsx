"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchSubmissions } from "@/lib/api-mock";
import { Submission } from "@/types";
import { ThemeBadge, UrgencyBadge, ChannelIcon, Spinner, EmptyState } from "@/components/ui";
import { MOCK_WARDS, MOCK_THEMES } from "@/lib/mock-data";

// ISO 639-1 code → display label
const LANG_LABELS: Record<string, string> = {
  hi: "HI", gu: "GU", ta: "TA", te: "TE", kn: "KN",
  mr: "MR", bn: "BN", pa: "PA", ml: "ML", ur: "UR",
};

function getLangCode(code: string | undefined): string | null {
  if (!code || code === "en" || code === "string") return null;
  return LANG_LABELS[code.toLowerCase()] ?? code.toUpperCase();
}

// Free translation via MyMemory (no API key, ~1000 req/day per IP)
async function translateToEnglish(text: string, langCode: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langCode}|en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Translation request failed");
  const data = await res.json();
  const translated: string = data?.responseData?.translatedText;
  if (!translated || translated === text) throw new Error("No translation returned");
  return translated;
}

export default function SubmissionsFeed() {
  const [items, setItems]       = useState<Submission[]>([]);
  const [loading, setLoading]   = useState(true);
  const [themeFilter, setTheme] = useState<string>("");
  const [wardFilter, setWard]   = useState<string>("");

  // id → translated English text (cached after first fetch)
  const [translations, setTranslations] = useState<Record<string, string>>({});
  // ids currently showing the English translation
  const [showingEN, setShowingEN] = useState<Set<string>>(new Set());
  // ids currently loading translation
  const [translating, setTranslating] = useState<Set<string>>(new Set());
  // ids where translation failed
  const [transErrors, setTransErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetchSubmissions({
      theme:   themeFilter || undefined,
      ward_id: wardFilter  || undefined,
    }).then(({ items }) => {
      setItems(items);
      setLoading(false);
    });
  }, [themeFilter, wardFilter]);

  const handleTranslate = useCallback(async (s: Submission) => {
    const id = s.id;

    // If already showing EN → toggle back to original
    if (showingEN.has(id)) {
      setShowingEN((prev) => { const n = new Set(prev); n.delete(id); return n; });
      return;
    }

    // If we already have a cached translation → just show it
    if (translations[id] || s.text_translated) {
      setShowingEN((prev) => new Set(prev).add(id));
      return;
    }

    // Fetch translation from MyMemory API
    const langCode = s.lang ?? "hi";
    setTranslating((prev) => new Set(prev).add(id));
    setTransErrors((prev) => { const n = new Set(prev); n.delete(id); return n; });
    try {
      const result = await translateToEnglish(s.text_raw ?? "", langCode);
      setTranslations((prev) => ({ ...prev, [id]: result }));
      setShowingEN((prev) => new Set(prev).add(id));
    } catch {
      setTransErrors((prev) => new Set(prev).add(id));
    } finally {
      setTranslating((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, [showingEN, translations]);

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
          {items.map((s, idx) => {
            const langCode    = getLangCode(s.lang);
            const isNonEn     = !!langCode;
            const isShowingEN = showingEN.has(s.id);
            const isLoading   = translating.has(s.id);
            const hasError    = transErrors.has(s.id);
            // Displayed text: cached live translation, then backend translation, then raw
            const displayText = isShowingEN
              ? (translations[s.id] ?? s.text_translated ?? s.text_raw)
              : (s.text_raw ?? s.text_translated);

            return (
              <div
                key={s.id}
                className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl p-4 space-y-3 hover:border-primary-200 hover:shadow-soft transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {displayText}
                    </p>

                    {/* Audio player — voice submissions */}
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

                  {/* Translate button — only for non-English submissions */}
                  {isNonEn && (
                    <button
                      onClick={() => handleTranslate(s)}
                      disabled={isLoading}
                      title={isShowingEN ? "Show original" : "Translate to English"}
                      className={`text-xs px-2 py-1 rounded-full font-semibold border transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-wait ${
                        isShowingEN
                          ? "bg-purple-600 text-white border-purple-700 hover:bg-purple-700"
                          : hasError
                          ? "bg-red-100 text-red-600 border-red-200 hover:bg-red-200"
                          : "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200"
                      }`}
                    >
                      {isLoading
                        ? "⏳ Translating…"
                        : hasError
                        ? "⚠️ Retry translate"
                        : isShowingEN
                        ? `🌐 EN → ${langCode}`
                        : `🌐 ${langCode} → EN`}
                    </button>
                  )}

                  <span className="text-xs text-gray-400 ml-auto font-medium">
                    {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
