"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPriorityProjects } from "@/lib/api-mock";
import { Project } from "@/types";
import { ThemeBadge, UrgencyBadge, ScoreBar, RankBadge, Spinner, EmptyState } from "@/components/ui";
import { formatPopulation } from "@/lib/constants";

export default function PriorityProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchPriorityProjects().then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!projects.length) return <EmptyState message="No priority projects found." />;

  return (
    <div className="space-y-4">
      {projects.map((p, idx) => (
        <div
          key={p.id}
          className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-2xl overflow-hidden hover:border-primary-300 hover:shadow-soft-lg transition-all duration-300 card-hover"
          style={{ animationDelay: `${idx * 0.05}s` }}
        >
          {/* Header row */}
          <div
            className="flex items-start gap-4 p-6 cursor-pointer"
            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
          >
            <RankBadge rank={p.priority_rank} />

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="font-bold text-gray-900 text-base leading-snug">{p.title}</h3>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <ThemeBadge theme={p.theme as any} />
                <span className="text-xs text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded-full">
                  📍 {p.ward_name}
                </span>
                <span className="text-xs text-gray-600 font-medium bg-primary-50 px-2 py-1 rounded-full">
                  👥 {p.submission_count} requests
                </span>
                {p.affected_population && (
                  <span className="text-xs text-gray-600 font-medium bg-mint-50 px-2 py-1 rounded-full">
                    🏘️ {formatPopulation(p.affected_population)} affected
                  </span>
                )}
              </div>
            </div>

            {/* Priority score pill */}
            <div className="flex-shrink-0 text-right">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-purple-500 rounded-xl blur opacity-30"></div>
                <div className="relative bg-gradient-to-r from-primary-600 to-purple-600 text-white px-4 py-3 rounded-xl shadow-soft">
                  <div className="text-2xl font-bold leading-none">
                    {Math.round(p.priority_score * 100)}
                  </div>
                  <div className="text-xs opacity-90 mt-0.5">score</div>
                </div>
              </div>
            </div>

            <button className="text-gray-400 hover:text-gray-600 transition-colors mt-1">
              <svg
                className={`w-5 h-5 transition-transform duration-300 ${expanded === p.id ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Expanded evidence panel */}
          {expanded === p.id && (
            <div className="border-t-2 border-gray-100 px-6 pb-6 pt-5 space-y-5 bg-gradient-to-br from-gray-50/50 to-white animate-slide-down">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <ScoreBar score={p.demand_score}      label="Demand"      />
                <ScoreBar score={p.gap_score}         label="Gap"         />
                <ScoreBar score={p.feasibility_score} label="Feasibility" />
                <ScoreBar score={p.urgency_score}     label="Urgency"     />
              </div>

              <div className="bg-gradient-to-br from-primary-50 to-purple-50 border-2 border-primary-200 rounded-xl p-5 text-sm text-gray-700 leading-relaxed shadow-soft">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 bg-primary-600 rounded-lg flex items-center justify-center text-white text-xs shadow-soft">
                    🤖
                  </span>
                  <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">AI Evidence Summary</p>
                </div>
                <p className="text-gray-800">{p.evidence_text}</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
                  Source: <span className="font-semibold capitalize text-gray-700">{p.source.replace("_", " ")}</span>
                </span>
                <Link
                  href={`/dashboard/project/${p.id}`}
                  className="text-sm text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
                >
                  View full details
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
