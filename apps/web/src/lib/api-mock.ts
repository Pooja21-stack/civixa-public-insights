/**
 * Mock-aware API hooks.
 *
 * While USE_MOCK_API=true  → returns mock data instantly (no backend needed).
 * When  USE_MOCK_API=false → calls the real FastAPI at NEXT_PUBLIC_API_URL.
 *
 * Frontend dev: you never need to touch this file.
 * Just work with useSubmissions(), useDashboard(), etc. in your components.
 */
import { USE_MOCK_API } from "@/lib/flags";
import { apiClient, submissionsApi, projectsApi } from "@/lib/api";
import {
  MOCK_DASHBOARD_STATS,
  MOCK_SUBMISSIONS,
  MOCK_PROJECTS,
  MOCK_THEMES,
  MOCK_WARDS,
  delay,
} from "@/lib/mock-data";
import type { DashboardStats, Project, Submission, Theme, Ward } from "@/types";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (USE_MOCK_API) {
    await delay(400);
    return MOCK_DASHBOARD_STATS;
  }
  const res = await apiClient.get("/api/v1/dashboard/stats");
  return res.data;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function fetchPriorityProjects(): Promise<Project[]> {
  if (USE_MOCK_API) {
    await delay(300);
    return MOCK_PROJECTS;
  }
  const res = await projectsApi.getPriority();
  return res.data.items;
}

export async function fetchProject(id: string): Promise<Project> {
  if (USE_MOCK_API) {
    await delay(200);
    const p = MOCK_PROJECTS.find((p) => p.id === id);
    if (!p) throw new Error("Project not found");
    return p;
  }
  const res = await projectsApi.getById(id);
  return res.data;
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export async function fetchSubmissions(params?: {
  theme?: string;
  ward_id?: string;
  page?: number;
}): Promise<{ items: Submission[]; total: number }> {
  if (USE_MOCK_API) {
    await delay(300);
    let items = [...MOCK_SUBMISSIONS];
    if (params?.theme) items = items.filter((s) => s.themes.includes(params.theme as any));
    if (params?.ward_id) items = items.filter((s) => s.ward_id === params.ward_id);
    return { items, total: items.length };
  }
  const res = await submissionsApi.list(params as any);
  return res.data;
}

export async function createSubmission(data: FormData): Promise<Submission> {
  if (USE_MOCK_API) {
    await delay(800);
    // Return a fake created submission so the form success state works
    const text = data.get("text_raw") as string;
    return {
      id: `sub-mock-${Date.now()}`,
      channel: "web",
      text_raw: text,
      text_translated: text,
      lang: "en",
      ward_id: (data.get("ward_id") as string) || undefined,
      ward_name: undefined,
      themes: ["other"],
      urgency_score: 0.5,
      urgency_level: "medium",
      created_at: new Date().toISOString(),
    };
  }
  const res = await submissionsApi.create(data);
  return res.data;
}

export async function fetchHotspots(): Promise<GeoJSON.FeatureCollection> {
  if (USE_MOCK_API) {
    await delay(200);
    // GeoJSON point features from mock submissions
    return {
      type: "FeatureCollection",
      features: MOCK_SUBMISSIONS.filter((s) => s.lat && s.lng).map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lng!, s.lat!] },
        properties: {
          id: s.id,
          urgency_score: s.urgency_score,
          theme: s.themes[0],
          ward_id: s.ward_id,
        },
      })),
    };
  }
  const res = await submissionsApi.getHotspots();
  return res.data;
}

// ─── Themes ───────────────────────────────────────────────────────────────────

export async function fetchThemes(): Promise<Theme[]> {
  if (USE_MOCK_API) {
    await delay(150);
    return MOCK_THEMES;
  }
  const res = await apiClient.get("/api/v1/themes");
  return res.data;
}

// ─── Wards ────────────────────────────────────────────────────────────────────

export async function fetchWards(): Promise<Ward[]> {
  if (USE_MOCK_API) {
    await delay(150);
    return MOCK_WARDS;
  }
  const res = await apiClient.get("/api/v1/wards");
  return res.data;
}
