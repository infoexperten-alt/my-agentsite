import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  CaretRight,
  List,
  FileHtml,
  SquaresFour,
  TreeStructure,
} from "@phosphor-icons/react";
import useProject from "../hooks/useProject";
import { fetchGuides } from "../api/projects";
import Spinner from "../components/shared/Spinner";

function PageCard({ page, index }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex gap-4">
      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-sm font-mono text-slate-400">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <FileHtml size={14} className="text-brand-400 shrink-0" />
          <span className="text-sm font-semibold text-white truncate">
            {page.title}
          </span>
          <span className="text-xs font-mono text-slate-500">/{page.slug}</span>
          {page.priority !== undefined && (
            <span className="text-[10px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded ml-auto shrink-0">
              P{page.priority}
            </span>
          )}
        </div>
        {page.sections && page.sections.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {page.sections.map((section, i) => (
              <span
                key={i}
                className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded"
              >
                {section}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SharedComponents({ components }) {
  if (!components || components.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
        <SquaresFour size={16} />
        Shared Components
      </h3>
      <div className="flex flex-wrap gap-2">
        {components.map((comp, i) => (
          <span
            key={i}
            className="text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg"
          >
            {comp}
          </span>
        ))}
      </div>
    </section>
  );
}

export default function ProjectNavigationPage() {
  const { projectId } = useParams();
  const { project } = useProject(projectId);
  const [sitePlan, setSitePlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    fetchGuides(projectId)
      .then((guides) => {
        const raw = guides?.["site-plan.json"];
        if (raw) {
          try {
            setSitePlan(JSON.parse(raw));
          } catch {
            setSitePlan(null);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-8 z-20">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Projects</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-slate-400">{project?.name || "..."}</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-white font-medium">Navigation</span>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size={32} />
            </div>
          ) : !sitePlan ? (
            <div className="flex items-center justify-center min-h-[calc(100vh-16rem)]">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-6">
                  <TreeStructure className="text-slate-500" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  No Site Plan Yet
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Generate a page to create a site plan. The PM agent will
                  define the page structure, sections, and shared components
                  for your project.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Header */}
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {sitePlan.project_name || "Site Structure"}
                </h1>
                {sitePlan.tagline && (
                  <p className="text-sm text-slate-400 mt-1">
                    {sitePlan.tagline}
                  </p>
                )}
              </div>

              {/* Pages */}
              <section>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <List size={16} />
                  Pages ({sitePlan.pages?.length || 0})
                </h3>
                <div className="space-y-2">
                  {(sitePlan.pages || []).map((page, i) => (
                    <PageCard key={page.slug || i} page={page} index={i} />
                  ))}
                </div>
              </section>

              {/* Shared components */}
              <SharedComponents components={sitePlan.shared_components} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
