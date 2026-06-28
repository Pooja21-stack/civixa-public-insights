import { ThemeKey, UrgencyLevel } from "@/types";

export const THEME_LABELS: Record<ThemeKey, string> = {
  roads:       "Roads & Transport",
  schools:     "Schools & Education",
  water:       "Water & Sanitation",
  health:      "Healthcare",
  electricity: "Electricity",
  other:       "Other",
};

export const THEME_COLORS: Record<ThemeKey, string> = {
  roads:       "#f59e0b",
  schools:     "#3b82f6",
  water:       "#06b6d4",
  health:      "#ef4444",
  electricity: "#8b5cf6",
  other:       "#6b7280",
};

export const THEME_BG: Record<ThemeKey, string> = {
  roads:       "bg-amber-100  text-amber-800",
  schools:     "bg-blue-100   text-blue-800",
  water:       "bg-cyan-100   text-cyan-800",
  health:      "bg-red-100    text-red-800",
  electricity: "bg-violet-100 text-violet-800",
  other:       "bg-gray-100   text-gray-700",
};

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  low:      "bg-green-100 text-green-800",
  medium:   "bg-yellow-100 text-yellow-800",
  high:     "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export const URGENCY_DOT: Record<UrgencyLevel, string> = {
  low:      "bg-green-500",
  medium:   "bg-yellow-500",
  high:     "bg-orange-500",
  critical: "bg-red-500",
};

export const WARD_OPTIONS = [
  { value: "ward-01", label: "Ward 1 — Central"  },
  { value: "ward-02", label: "Ward 2 — North"    },
  { value: "ward-03", label: "Ward 3 — East"     },
  { value: "ward-04", label: "Ward 4 — South"    },
  { value: "ward-05", label: "Ward 5 — West"     },
];

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English"    },
  { code: "hi", label: "हिंदी"      },
  { code: "mr", label: "मराठी"      },
  { code: "ta", label: "தமிழ்"      },
  { code: "te", label: "తెలుగు"     },
  { code: "kn", label: "ಕನ್ನಡ"      },
  { code: "gu", label: "ગુજરાતી"    },
  { code: "bn", label: "বাংলা"      },
];

export function formatPriorityScore(score: number): string {
  return (score * 100).toFixed(0);
}

export function formatPopulation(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
