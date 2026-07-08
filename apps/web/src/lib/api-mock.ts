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
import type { DashboardStats, Project, Submission, Theme, ThemeKey, Ward } from "@/types";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (USE_MOCK_API) {
    await delay(400);
    return MOCK_DASHBOARD_STATS;
  }
  const res = await apiClient.get("/api/v1/dashboard/stats");
  const d = res.data;

  // Normalise real API response → DashboardStats shape the components expect
  return {
    ...d,
    // Map theme_breakdown → top_themes
    top_themes: (d.theme_breakdown ?? []).map((t: { theme: string; count: number }) => ({
      theme: t.theme as any,
      count: t.count,
    })),
    // Map active_wards → wards_covered
    wards_covered: d.active_wards ?? 0,
    // Map top_priority_projects → top_projects
    top_projects: (d.top_priority_projects ?? []) as any[],
    // submissions_today not tracked by API yet — default to 0
    submissions_today: 0,
  };
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

// localStorage key — stores submissions WITHOUT audio (audio is too large for LS)
const LS_KEY = "civixa_session_submissions";

// Module-level map: submission id → object URL for audio (lives for the browser session)
const AUDIO_OBJECT_URLS = new Map<string, string>();

function loadSessionSubmissions(): Submission[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || "[]") as Submission[];
    // Re-attach any in-memory audio URLs that survived this session
    return stored.map((s) =>
      AUDIO_OBJECT_URLS.has(s.id)
        ? { ...s, audio_url: AUDIO_OBJECT_URLS.get(s.id) }
        : s
    );
  } catch { return []; }
}

function saveSessionSubmissions(items: Submission[]) {
  if (typeof window === "undefined") return;
  // Strip audio_url before storing — object URLs and data URIs are too large / non-serialisable
  const stripped = items.slice(-50).map(({ audio_url, ...rest }) => rest);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(stripped));
  } catch { /* quota exceeded — skip */ }
}

export async function fetchSubmissions(params?: {
  theme?: string;
  ward_id?: string;
  page?: number;
}): Promise<{ items: Submission[]; total: number }> {
  if (USE_MOCK_API) {
    await delay(300);
    // Merge session submissions (newest first, audio URLs re-attached) with mock data
    const session = loadSessionSubmissions();
    let items = [
      ...session.slice().reverse(),
      ...MOCK_SUBMISSIONS,
    ];
    if (params?.theme) items = items.filter((s) => s.themes.includes(params.theme as any));
    if (params?.ward_id) items = items.filter((s) => s.ward_id === params.ward_id);
    return { items, total: items.length };
  }
  const res = await submissionsApi.list(params as any);
  const d = res.data;
  // Normalise: API now returns lang and ward_name directly; keep fallbacks for safety
  const items = (d.items ?? []).map((s: any) => ({
    ...s,
    lang:      s.lang      ?? s.lang_detected ?? "en",
    ward_name: s.ward_name ?? undefined,
  }));
  return { items, total: d.total ?? items.length };
}

export async function createSubmission(data: FormData): Promise<Submission> {
  if (USE_MOCK_API) {
    await delay(800);
    const text    = (data.get("text_raw") as string) || "";
    const channel = (data.get("channel")  as string) || "web";
    const wardId  = (data.get("ward_id")  as string) || undefined;
    const lang    = (data.get("lang")     as string) || "en";
    const theme   = (data.get("theme")    as string) || "other";

    // Resolve ward name from the ward ID
    const wardName = wardId
      ? MOCK_WARDS.find((w) => w.id === wardId)?.name
      : undefined;

    // Create a blob object URL for the audio — stored in memory, not localStorage
    let audio_url: string | undefined;
    if (channel === "voice") {
      const blob = data.get("media") as Blob | null;
      if (blob && blob.size > 0) {
        audio_url = URL.createObjectURL(blob);
      }
    }

    // Simple urgency scoring based on text length / keywords
    const urgency_score = text.length > 100 ? 0.75 : 0.5;
    const urgency_level = urgency_score >= 0.75 ? "high" : "medium";

    const id = `sub-mock-${Date.now()}`;
    const submission: Submission = {
      id,
      channel: channel as Submission["channel"],
      text_raw: text,
      // No backend translation in mock mode — the feed calls MyMemory API on demand.
      text_translated: lang === "en" ? text : undefined,
      lang,
      ward_id: wardId,
      ward_name: wardName,
      themes: [theme as ThemeKey],
      urgency_score,
      urgency_level: urgency_level as Submission["urgency_level"],
      created_at: new Date().toISOString(),
      audio_url,
    };

    // Keep the object URL in the module-level map so it survives navigation
    if (audio_url) AUDIO_OBJECT_URLS.set(id, audio_url);

    // Save metadata (without audio) to localStorage for cross-navigation persistence
    const existing = loadSessionSubmissions();
    saveSessionSubmissions([...existing, submission]);
    return submission;
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
  // Real API returns { items: [...], total: N }
  return res.data.items ?? res.data;
}
