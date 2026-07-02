import { useState, useMemo } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  Zap,
  Activity,
  CheckCircle2,
  Users,
  BookOpen,
  Layers,
  ClipboardList,
} from "lucide-react";
import { useOptimizationEngine } from "../hooks/useOptimizationEngine";
import type { OptimizationRecommendation } from "../types/Optimization";

// ─── Preview Modal ─────────────────────────────────────────────────────────────

interface PreviewModalProps {
  recommendation: OptimizationRecommendation;
  onClose: () => void;
}

function PreviewModal({ recommendation, onClose }: PreviewModalProps) {
  const { healthImpact, implementationStrategy, affectedEntities } = recommendation;
  const hasHealthGain = healthImpact.estimatedHealthIncrease > 0;

  const entityIcon = (type: OptimizationRecommendation["affectedEntities"][0]["entityType"]) => {
    switch (type) {
      case "teacher": return <Users className="w-3.5 h-3.5" />;
      case "class": return <Layers className="w-3.5 h-3.5" />;
      case "subject": return <BookOpen className="w-3.5 h-3.5" />;
      case "allocation": return <ClipboardList className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-100"
        style={{ animation: "modalIn 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-indigo-100 rounded-xl mt-0.5">
              <Eye className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                Preview: {recommendation.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                This is a read-only preview. No changes have been made.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-700"
            title="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current State vs Expected State */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-red-50/60 border border-red-100">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-red-500 mb-2">
                Current State
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">Health Score</span>
                  <span className="text-sm font-extrabold text-red-700">
                    {healthImpact.currentHealthScore}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">Active Conflicts</span>
                  <span className="text-sm font-extrabold text-red-700">
                    {healthImpact.conflictsRemovedCount + healthImpact.conflictsRemainingCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-green-50/60 border border-green-100">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-green-600 mb-2">
                Expected State (After Fix)
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">Health Score</span>
                  <span className="text-sm font-extrabold text-green-700">
                    {healthImpact.estimatedNewHealthScore}
                    {hasHealthGain && (
                      <span className="ml-1 text-[10px] text-green-600 font-bold">
                        (+{healthImpact.estimatedHealthIncrease})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">Conflicts Remaining</span>
                  <span className="text-sm font-extrabold text-green-700">
                    {healthImpact.conflictsRemainingCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Health Delta Bar */}
          {hasHealthGain && (
            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  Health Score Delta
                </p>
                <span className="text-sm font-extrabold text-indigo-700">
                  +{healthImpact.estimatedHealthIncrease} pts
                </span>
              </div>
              <div className="relative w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-slate-300 rounded-full transition-all"
                  style={{ width: `${healthImpact.currentHealthScore}%` }}
                />
                <div
                  className="absolute inset-y-0 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
                  style={{
                    left: `${healthImpact.currentHealthScore}%`,
                    width: `${healthImpact.estimatedHealthIncrease}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1.5">
                <span>0</span>
                <span>100</span>
              </div>
            </div>
          )}

          {/* Conflicts Resolved */}
          {healthImpact.conflictsRemovedCount > 0 && (
            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 mb-2">
                Conflicts This Fix Resolves ({healthImpact.conflictsRemovedCount})
              </p>
              <div className="space-y-1">
                {healthImpact.conflictIdsResolved.map((cId) => (
                  <div key={cId} className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-xs text-slate-700 font-medium font-mono">{cId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected Entities */}
          {affectedEntities.length > 0 && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Affected Entities
              </p>
              <div className="flex flex-wrap gap-2">
                {affectedEntities.map((entity) => (
                  <span
                    key={entity.entityId}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200"
                  >
                    {entityIcon(entity.entityType)}
                    <span>{entity.entityName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Implementation Steps */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-3">
              Implementation Steps
            </p>
            <ol className="space-y-2">
              {implementationStrategy.steps.map((step, idx) => (
                <li key={idx} className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-extrabold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Navigation hint */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-xs font-semibold text-amber-800 flex items-center space-x-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                To apply this fix, navigate to the relevant allocation(s) listed above and make the changes manually. The health score will update automatically.
              </span>
            </p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition duration-200"
          >
            Close Preview
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Recommendation Card ──────────────────────────────────────────────────────

interface RecommendationCardProps {
  rec: OptimizationRecommendation;
  onPreview: (rec: OptimizationRecommendation) => void;
}

function RecommendationCard({ rec, onPreview }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const priorityConfig = {
    critical: {
      badge: "bg-red-100 text-red-800 border-red-200",
      border: "border-red-200",
      icon: <AlertCircle className="w-4 h-4 text-red-500" />,
      label: "Critical",
    },
    high: {
      badge: "bg-amber-100 text-amber-800 border-amber-200",
      border: "border-amber-200",
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      label: "High",
    },
    medium: {
      badge: "bg-blue-100 text-blue-800 border-blue-200",
      border: "border-blue-100",
      icon: <Info className="w-4 h-4 text-blue-500" />,
      label: "Medium",
    },
    low: {
      badge: "bg-slate-100 text-slate-600 border-slate-200",
      border: "border-slate-100",
      icon: <Activity className="w-4 h-4 text-slate-400" />,
      label: "Low",
    },
  };

  const effortColors = {
    low: "text-emerald-700 bg-emerald-50 border-emerald-200",
    medium: "text-amber-700 bg-amber-50 border-amber-200",
    high: "text-red-700 bg-red-50 border-red-200",
  };

  const config = priorityConfig[rec.priority];
  const hasHealthGain = rec.healthImpact.estimatedHealthIncrease > 0;

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-all duration-200 ${config.border}`}
    >
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between space-x-3">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            <div className="mt-0.5 flex-shrink-0">{config.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-slate-900 leading-tight">
                {rec.title}
              </p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {rec.description}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border flex-shrink-0 ${config.badge}`}
          >
            {config.label}
          </span>
        </div>

        {/* Metrics Row */}
        <div className="flex items-center flex-wrap gap-2 mt-3">
          {hasHealthGain && (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[10px] font-extrabold">
              <TrendingUp className="w-3 h-3" />
              <span>+{rec.healthImpact.estimatedHealthIncrease} pts</span>
            </span>
          )}
          {rec.healthImpact.conflictsRemovedCount > 0 && (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-extrabold">
              <CheckCircle2 className="w-3 h-3" />
              <span>Resolves {rec.healthImpact.conflictsRemovedCount} conflict{rec.healthImpact.conflictsRemovedCount > 1 ? "s" : ""}</span>
            </span>
          )}
          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${effortColors[rec.effort]}`}>
            <Zap className="w-3 h-3" />
            <span>{rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1)} Effort</span>
          </span>
          <span className="inline-flex items-center px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-extrabold">
            {rec.confidenceScore}% confidence
          </span>
        </div>
      </div>

      {/* Expandable Steps Preview */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-50">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mt-3 mb-2">
            Quick Steps
          </p>
          <ol className="space-y-1.5">
            {rec.implementationStrategy.steps.slice(0, 3).map((step, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-[9px] font-extrabold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">{step}</p>
              </li>
            ))}
            {rec.implementationStrategy.steps.length > 3 && (
              <li className="text-[10px] text-indigo-600 font-semibold pl-6">
                +{rec.implementationStrategy.steps.length - 3} more steps in Preview...
              </li>
            )}
          </ol>
        </div>
      )}

      {/* Card Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-50 bg-slate-50/50 rounded-b-xl">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center space-x-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 transition"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{expanded ? "Collapse" : "Quick Preview"}</span>
        </button>
        <button
          onClick={() => onPreview(rec)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition duration-200"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Full Preview</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Optimization Panel ────────────────────────────────────────────────────────

export function OptimizationPanel() {
  const { engineOutput, isAnalyzing, isStale, analyzeNow, clearRecommendations } =
    useOptimizationEngine();
  const [previewRec, setPreviewRec] = useState<OptimizationRecommendation | null>(null);

  const hasResults = engineOutput !== null;
  const { recommendations = [], summary } = engineOutput ?? {};

  // Group by priority for display
  const grouped = useMemo(() => {
    const critical = recommendations.filter((r) => r.priority === "critical");
    const high = recommendations.filter((r) => r.priority === "high");
    const medium = recommendations.filter((r) => r.priority === "medium");
    const low = recommendations.filter((r) => r.priority === "low");
    return { critical, high, medium, low };
  }, [recommendations]);

  const totalHealthGain = summary?.maxHealthGain ?? 0;

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-8 overflow-hidden">
        {/* Panel Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Optimization Engine
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Analyze conflicts and get actionable improvement recommendations.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {hasResults && !isAnalyzing && (
              <button
                onClick={clearRecommendations}
                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              >
                Clear Results
              </button>
            )}
            <button
              id="analyze-timetable-btn"
              onClick={analyzeNow}
              disabled={isAnalyzing}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white text-sm font-bold rounded-xl shadow-sm transition duration-200"
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" strokeLinecap="round" />
                  </svg>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{hasResults ? "Re-Analyze Timetable" : "Analyze Timetable"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Summary Bar — shown after first analysis */}
        {hasResults && !isAnalyzing && (
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-slate-900">{recommendations.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                  Recommendations
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-emerald-600">
                  {totalHealthGain > 0 ? `+${totalHealthGain}` : "0"}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                  Max Health Gain
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-red-600">{summary?.criticalCount ?? 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                  Critical Issues
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-amber-600">{summary?.highCount ?? 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                  High Priority
                </p>
              </div>
            </div>

            {isStale && (
              <div className="mt-3 flex items-center space-x-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Allocations or conflicts changed since last analysis. Click "Re-Analyze" to refresh.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!hasResults && !isAnalyzing && (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-indigo-400" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-2">
              Ready to Optimize
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Click <strong>Analyze Timetable</strong> to scan your current allocations and
              receive prioritized improvement recommendations.
            </p>
          </div>
        )}

        {/* Results — zero recommendations */}
        {hasResults && recommendations.length === 0 && !isAnalyzing && (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-2">
              No Optimizations Needed
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Your timetable allocation is well-structured. No improvement recommendations at this time.
            </p>
          </div>
        )}

        {/* Recommendation Groups */}
        {hasResults && recommendations.length > 0 && !isAnalyzing && (
          <div className="p-6 space-y-6">
            {grouped.critical.length > 0 && (
              <section>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-500 mb-3 flex items-center space-x-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>🚨 Critical — Resolve First ({grouped.critical.length})</span>
                </h3>
                <div className="space-y-3">
                  {grouped.critical.map((r) => (
                    <RecommendationCard key={r.id} rec={r} onPreview={setPreviewRec} />
                  ))}
                </div>
              </section>
            )}

            {grouped.high.length > 0 && (
              <section>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-500 mb-3 flex items-center space-x-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>⚡ High Priority ({grouped.high.length})</span>
                </h3>
                <div className="space-y-3">
                  {grouped.high.map((r) => (
                    <RecommendationCard key={r.id} rec={r} onPreview={setPreviewRec} />
                  ))}
                </div>
              </section>
            )}

            {grouped.medium.length > 0 && (
              <section>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-500 mb-3 flex items-center space-x-2">
                  <Info className="w-3.5 h-3.5" />
                  <span>💡 Medium Priority ({grouped.medium.length})</span>
                </h3>
                <div className="space-y-3">
                  {grouped.medium.map((r) => (
                    <RecommendationCard key={r.id} rec={r} onPreview={setPreviewRec} />
                  ))}
                </div>
              </section>
            )}

            {grouped.low.length > 0 && (
              <section>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
                  <Activity className="w-3.5 h-3.5" />
                  <span>📋 Advisory ({grouped.low.length})</span>
                </h3>
                <div className="space-y-3">
                  {grouped.low.map((r) => (
                    <RecommendationCard key={r.id} rec={r} onPreview={setPreviewRec} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewRec && (
        <PreviewModal
          recommendation={previewRec}
          onClose={() => setPreviewRec(null)}
        />
      )}
    </>
  );
}
