/**
 * USE_MOCK_API — controls whether API calls hit the real FastAPI backend or use local mock data.
 *
 * Toggle options:
 *   1. Set NEXT_PUBLIC_USE_MOCK_API=false in apps/web/.env.local  (recommended)
 *   2. Hard-code false here during development
 *
 * While true  → returns rich mock data with simulated delay (no backend needed).
 * While false → calls the real FastAPI at NEXT_PUBLIC_API_URL (default http://localhost:8000).
 */
export const USE_MOCK_API: boolean =
  process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";
