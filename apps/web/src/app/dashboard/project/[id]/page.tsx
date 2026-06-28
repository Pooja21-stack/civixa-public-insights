"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchProject } from "@/lib/api-mock";
import { Project } from "@/types";
import { ThemeBadge, ScoreBar, RankBadge, Spinner } from "@/components/ui";
import { formatPopulation } from "@/lib/constants";
import Navbar from "@/components/Navbar";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchProject(id).then(setProject).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <>
      <Navbar active="/dashboard" />
      <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>
    </>
  );
  if (!project) return (
    <>
      <Navbar active="/dashboard" />
      <div className="text-center py-20 text-gray-500">Project not found.</div>
    </>
  );

  return (
    <>
      <Navbar active="/dashboard" />
      <main className="min-h-[calc(100vh-56px)] bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Back */}
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Back to dashboard</Link>

          {/* Title card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-4">
              <RankBadge rank={project.priority_rank} />
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-snug">{project.title}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{project.ward_name}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <ThemeBadge theme={project.theme as any} />
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                {project.source.replace("_", " ")}
              </span>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed">{project.description}</p>

            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{Math.round(project.priority_score * 100)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Priority Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{project.submission_count}</p>
                <p className="text-xs text-gray-400 mt-0.5">Submissions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {project.affected_population ? formatPopulation(project.affected_population) : "—"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Affected</p>
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Score Breakdown</h2>
            <div className="space-y-3">
              <ScoreBar score={project.demand_score}      label="Demand (citizen submissions)" />
              <ScoreBar score={project.gap_score}         label="Infrastructure Gap" />
              <ScoreBar score={project.feasibility_score} label="Feasibility" />
              <ScoreBar score={project.urgency_score}     label="Urgency" />
            </div>
            <p className="text-xs text-gray-400 pt-1">
              Formula: demand×0.40 + gap×0.35 + feasibility×0.15 + urgency×0.10
            </p>
          </div>

          {/* AI Evidence */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">AI Evidence Summary</h2>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">
              {project.evidence_text}
            </p>
          </div>

        </div>
      </main>
    </>
  );
}
