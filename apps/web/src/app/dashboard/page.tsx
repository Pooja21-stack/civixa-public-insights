import Navbar from "@/components/Navbar";
import DashboardStatsPanel from "@/components/DashboardStatsPanel";
import PriorityProjectsList from "@/components/PriorityProjectsList";
import DemandHeatmap from "@/components/DemandHeatmap";
import SubmissionsFeed from "@/components/SubmissionsFeed";

export default function DashboardPage() {
  return (
    <>
      <Navbar active="/dashboard" />
      <main className="min-h-[calc(100vh-56px)] bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">MP Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">Demo Constituency · AI-ranked development priorities</p>
            </div>
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition flex items-center gap-2">
              📄 Export PDF
            </button>
          </div>

          {/* Stats + chart */}
          <DashboardStatsPanel />

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Priority projects — wider column */}
            <div className="lg:col-span-3 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Priority Works
              </h2>
              <PriorityProjectsList />
            </div>

            {/* Right column: heatmap + feed */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Demand Heatmap
                </h2>
                <DemandHeatmap />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Recent Submissions
                </h2>
                <SubmissionsFeed />
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
