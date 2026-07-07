"use client";

import Navbar from "@/components/Navbar";
import DashboardStatsPanel from "@/components/DashboardStatsPanel";
import PriorityProjectsList from "@/components/PriorityProjectsList";
import DemandHeatmap from "@/components/DemandHeatmap";
import SubmissionsFeed from "@/components/SubmissionsFeed";

export default function DashboardPage() {
  return (
    <>
      <Navbar active="/dashboard" />
      <main className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-primary-50/20 via-white to-purple-50/20 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Header */}
          <div className="animate-slide-down">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-primary-200 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-soft mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              Live Dashboard
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">MP Dashboard</h1>
            <p className="text-sm text-gray-600">My Constituency · AI-ranked development priorities</p>
          </div>

          {/* Stats + chart */}
          <div className="animate-slide-up">
            <DashboardStatsPanel />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {/* Priority projects — wider column */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-8 h-8 bg-gradient-to-r from-primary-600 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm shadow-soft">
                    🎯
                  </span>
                  Priority Works
                </h2>
                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
                  Ranked by AI
                </span>
              </div>
              <PriorityProjectsList />
            </div>

            {/* Right column: heatmap + feed */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 bg-gradient-to-r from-rose-500 to-amber-500 rounded-lg flex items-center justify-center text-white text-sm shadow-soft">
                      🗺️
                    </span>
                    Demand Heatmap
                  </h2>
                </div>
                <DemandHeatmap />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 bg-gradient-to-r from-mint-500 to-primary-500 rounded-lg flex items-center justify-center text-white text-sm shadow-soft">
                      📝
                    </span>
                    Recent Submissions
                  </h2>
                </div>
                <SubmissionsFeed />
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
