export type Channel = "web" | "whatsapp" | "voice";
export type ThemeKey = "roads" | "schools" | "water" | "health" | "electricity" | "other";
export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export interface Submission {
  id: string;
  channel: Channel;
  text_raw: string;
  text_translated?: string;
  lang?: string;           // frontend alias
  lang_detected?: string;  // real API field
  lat?: number;
  lng?: number;
  ward_id?: string;
  ward_name?: string;
  themes: ThemeKey[];
  urgency_score: number;
  urgency_level: UrgencyLevel;
  created_at: string;
  audio_url?: string;      // data: URI for voice submissions (mock) or remote URL (API)
}

export interface Theme {
  id: string;
  name: string;
  key: ThemeKey;
  submission_count: number;
  hotspot_geojson?: GeoJSON.FeatureCollection;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  theme: ThemeKey;
  ward_id: string;
  ward_name: string;
  demand_score: number;
  gap_score: number;
  feasibility_score: number;
  urgency_score: number;
  priority_score: number;
  priority_rank: number;
  evidence_text: string;
  submission_count: number;
  affected_population?: number;
  source: "citizen" | "dev_plan" | "combined";
}

export interface Ward {
  id: string;
  name: string;
  population: number;
  submission_count: number;
  top_theme: ThemeKey;
}

export interface DashboardStats {
  total_submissions: number;
  submissions_today: number;       // frontend alias (0 if not from API)
  top_themes: { theme: ThemeKey; count: number }[];  // frontend alias
  wards_covered: number;           // frontend alias
  top_projects: Project[];         // frontend alias

  // Real API fields (also present when USE_MOCK_API=false)
  processed_submissions?: number;
  theme_breakdown?: { theme: string; count: number; pct: number }[];
  urgency_distribution?: { low: number; medium: number; high: number; critical: number };
  top_priority_projects?: Partial<Project>[];
  active_wards?: number;
}
