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
      {projects.map((p) => (
        <div
          key={p.id}
          className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors"
        >
          {/* Header row */}
          <div
            className="flex items-start gap-4 p-5 cursor-pointer"
            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
          >
            <RankBadge rank={p.priority_rank} />

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">{p.title}</h3>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <ThemeBadge theme={p.theme as any} />
                <span className="text-xs text-gray-500">{p.ward_name}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">{p.submission_count} submissions</span>
                {p.affected_population && (
                  <>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{formatPopulation(p.affected_population)} affected</span>
                  </>
                )}
              </div>
            </div>

            {/* Priority score pill */}
            <div className="flex-shrink-0 text-right">
              <div className="text-2xl font-bold text-gray-900 leading-none">
                {Math.round(p.priority_score * 100)}
              </div>
              <div className="text-xs text-gray-400">score</div>
            </div>

            <span className="text-gray-400 text-xs mt-1">{expanded === p.id ? "▲" : "▼"}</span>
          </div>

          {/* Expanded evidence panel */}
          {expanded === p.id && (
            <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ScoreBar score={p.demand_score}      label="Demand"      />
                <ScoreBar score={p.gap_score}         label="Gap"         />
                <ScoreBar score={p.feasibility_score} label="Feasibility" />
                <ScoreBar score={p.urgency_score}     label="Urgency"     />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">AI Evidence</p>
                {p.evidence_text}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Source: <span className="font-medium capitalize">{p.source.replace("_", " ")}</span>
                </span>
                <Link
                  href={`/dashboard/project/${p.id}`}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  View full details →
                </Link>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
