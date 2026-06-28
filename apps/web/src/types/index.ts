export type Channel = "web" | "whatsapp" | "voice";
export type ThemeKey = "roads" | "schools" | "water" | "health" | "electricity" | "other";
export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export interface Submission {
  id: string;
  channel: Channel;
  text_raw: string;
  text_translated: string;
  lang: string;
  lat?: number;
  lng?: number;
  ward_id?: string;
  ward_name?: string;
  themes: ThemeKey[];
  urgency_score: number;
  urgency_level: UrgencyLevel;
  created_at: string;
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
  submissions_today: number;
  top_themes: { theme: ThemeKey; count: number }[];
  wards_covered: number;
  top_projects: Project[];
}
