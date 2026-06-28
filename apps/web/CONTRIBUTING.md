# Frontend Contribution Guide

> **For the frontend team member.** Everything you need to start building immediately — no backend required.

---

## 1. Quick Start (5 minutes)

```bash
# Clone the repo
git clone <repo-url>
cd civixa-public-insights/apps/web

# Install dependencies
npm install

# Copy env file (only Mapbox token needed for the map — everything else works without it)
cp .env.local.example .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the full app running with mock data.

---

## 2. What's Already Built

| Page | Route | Status |
|------|-------|--------|
| Landing page | `/` | ✅ Complete |
| Citizen submission form | `/submit` | ✅ Complete (text + voice + category + ward) |
| MP Dashboard | `/dashboard` | ✅ Complete (stats, priority list, heatmap, feed) |
| Project detail | `/dashboard/project/[id]` | ✅ Complete |

| Component | File | Description |
|-----------|------|-------------|
| `Navbar` | `src/components/Navbar.tsx` | Top nav with active state |
| `SubmissionForm` | `src/components/SubmissionForm.tsx` | Multi-step form with voice recording |
| `PriorityProjectsList` | `src/components/PriorityProjectsList.tsx` | Ranked cards with expandable evidence |
| `DashboardStatsPanel` | `src/components/DashboardStatsPanel.tsx` | Stat cards + bar chart |
| `DemandHeatmap` | `src/components/DemandHeatmap.tsx` | Mapbox heatmap of submissions |
| `SubmissionsFeed` | `src/components/SubmissionsFeed.tsx` | Filterable submission list |
| `ui.tsx` | `src/components/ui.tsx` | Shared: `ThemeBadge`, `UrgencyBadge`, `ScoreBar`, `StatCard`, `Spinner`, etc. |

---

## 3. Mock API — No Backend Needed

All data is served from `src/lib/mock-data.ts` while the backend is being built.

**The single toggle is in `src/lib/flags.ts`:**

```ts
export const USE_MOCK_API = true;   // ← flip to false when backend is ready
```

When `true`:
- All API calls return realistic mock data with a simulated network delay
- Form submissions return a fake success response
- No network calls are made

**Mock data files:**
- `src/lib/mock-data.ts` — 5 wards, 6 themes, 6 submissions, 5 priority projects
- `data/seeds/sample_submissions.json` — same data as JSON (used by backend seeder)

**API functions** (use these in your components — don't call `axios` directly):

```ts
import { fetchDashboardStats, fetchPriorityProjects, fetchSubmissions,
         createSubmission, fetchHotspots, fetchThemes, fetchWards } from "@/lib/api-mock";
```

---

## 4. Project Structure

```
apps/web/src/
├── app/                        ← Next.js App Router pages
│   ├── page.tsx                   Landing
│   ├── submit/page.tsx            Citizen form
│   ├── dashboard/
│   │   ├── page.tsx               MP dashboard
│   │   └── project/[id]/page.tsx  Project detail
│   ├── layout.tsx                 Root layout
│   └── globals.css                Tailwind base
│
├── components/                 ← React components (one per file)
│   ├── Navbar.tsx
│   ├── SubmissionForm.tsx
│   ├── PriorityProjectsList.tsx
│   ├── DashboardStatsPanel.tsx
│   ├── DemandHeatmap.tsx
│   ├── SubmissionsFeed.tsx
│   └── ui.tsx                     ← All small shared UI primitives
│
├── lib/
│   ├── api-mock.ts             ← USE THIS for all data fetching
│   ├── api.ts                  ← Raw axios client (don't use directly)
│   ├── mock-data.ts            ← All demo data
│   ├── constants.ts            ← Theme labels, colors, ward options
│   ├── flags.ts                ← USE_MOCK_API toggle
│   └── i18n.ts                 ← i18next config (EN + Hindi)
│
└── types/
    └── index.ts                ← All TypeScript types
```

---

## 5. TypeScript Types (know these)

```ts
// The 6 development themes
type ThemeKey = "roads" | "schools" | "water" | "health" | "electricity" | "other";

// A citizen submission
interface Submission {
  id: string; channel: "web"|"whatsapp"|"voice";
  text_raw: string; text_translated: string; lang: string;
  ward_id?: string; ward_name?: string;
  themes: ThemeKey[]; urgency_score: number; urgency_level: "low"|"medium"|"high"|"critical";
  created_at: string;
}

// A ranked development project
interface Project {
  id: string; title: string; theme: ThemeKey;
  ward_id: string; ward_name: string;
  demand_score: number; gap_score: number; feasibility_score: number; urgency_score: number;
  priority_score: number; priority_rank: number;
  evidence_text: string; submission_count: number; affected_population?: number;
  source: "citizen" | "dev_plan" | "combined";
}
```

---

## 6. Styling Guide

- **Framework**: Tailwind CSS v3
- **Color palette**: blue-600 for primary, gray scale for text, theme-specific colors in `constants.ts`
- **Border radius**: `rounded-xl` or `rounded-2xl` for cards; `rounded-lg` for inputs/buttons
- **Card pattern**: `bg-white border border-gray-200 rounded-xl p-5`
- **Page wrapper**: `bg-gray-50 py-8 px-4` with `max-w-6xl mx-auto`

Shared UI components are in `src/components/ui.tsx`:
```tsx
<ThemeBadge theme="schools" />          // coloured pill
<UrgencyBadge level="critical" />       // coloured dot + label
<ScoreBar score={0.87} label="Demand"/> // horizontal bar 0–100
<StatCard label="Total" value={176} />  // stat tile
<Spinner size="md" />                   // loading spinner
<EmptyState message="No results" />     // empty placeholder
<RankBadge rank={1} />                  // #1 gold, #2 silver, #3 bronze
<ChannelIcon channel="whatsapp" />      // emoji icon
```

---

## 7. Mapbox Heatmap Setup

The heatmap works without a token — it shows a placeholder with setup instructions.

To enable it:
1. Get a free token at [https://account.mapbox.com/access-tokens/](https://account.mapbox.com/access-tokens/)
2. Add to `apps/web/.env.local`:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
   ```
3. Reload the dev server

---

## 8. Adding a New Page

```tsx
// apps/web/src/app/your-page/page.tsx
import Navbar from "@/components/Navbar";

export default function YourPage() {
  return (
    <>
      <Navbar active="/your-page" />
      <main className="min-h-[calc(100vh-56px)] bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* your content */}
        </div>
      </main>
    </>
  );
}
```

Add the route to `Navbar.tsx` if it needs a nav link.

---

## 9. Adding a New Component

```tsx
// apps/web/src/components/MyComponent.tsx
"use client";   // ← only if it uses useState/useEffect

import { fetchSomething } from "@/lib/api-mock";   // always use api-mock, not api.ts

export default function MyComponent() {
  // ...
}
```

---

## 10. Switching to Real Backend

When the backend team finishes the API:

1. Open `src/lib/flags.ts` and set `USE_MOCK_API = false`
2. Add `NEXT_PUBLIC_API_URL=http://localhost:8000` to `.env.local`
3. Restart the dev server

That's it. All components will automatically call the real API.

---

## 11. Available Scripts

```bash
npm run dev      # Start dev server on :3000
npm run build    # Production build
npm run lint     # ESLint check
npx tsc --noEmit # TypeScript check
```

---

## 12. Key Things NOT to Do

- ❌ Don't import from `src/lib/api.ts` directly — always use `src/lib/api-mock.ts`
- ❌ Don't hardcode data in components — use `mock-data.ts` or `api-mock.ts`
- ❌ Don't use inline styles — use Tailwind classes
- ❌ Don't add `"use client"` unless the component actually needs browser APIs
