"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import DashboardStatsPanel from "@/components/DashboardStatsPanel";
import PriorityProjectsList from "@/components/PriorityProjectsList";
import DemandHeatmap from "@/components/DemandHeatmap";
import SubmissionsFeed from "@/components/SubmissionsFeed";

export default function DashboardPage() {
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = () => {
    setExporting(true);
    
    // Simulate PDF generation
    setTimeout(() => {
      // Create a simple alert for demo
      alert("📄 PDF Report Generated!\n\nYour constituency report has been prepared with:\n\n✓ Priority projects ranking\n✓ Demand heatmap analysis\n✓ Submission statistics\n✓ AI-generated insights\n\nIn production, this would download a PDF file.");
      setExporting(false);
    }, 2000);
  };

  return (
    <>
      <Navbar active="/dashboard" />
      <main className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-primary-50/20 via-white to-purple-50/20 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-slide-down">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-primary-200 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-soft mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
                Live Dashboard
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">MP Dashboard</h1>
              <p className="text-sm text-gray-600">Demo Constituency · AI-ranked development priorities</p>
            </div>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white border-2 border-primary-700 rounded-xl text-sm font-semibold hover:from-primary-700 hover:to-primary-800 transition-all shadow-soft hover:shadow-glow-blue flex items-center gap-2 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export PDF Report</span>
                </>
              )}
            </button>
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
