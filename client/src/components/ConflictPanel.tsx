import type { Conflict } from "../store/schoolStore";
import { AlertCircle, AlertTriangle, Info, RefreshCw } from "lucide-react";

interface ConflictPanelProps {
  conflicts: Conflict[];
  selectedConflict: Conflict | null;
  onSelectConflict: (conflict: Conflict | null) => void;
}

export function ConflictPanel({ 
  conflicts, 
  selectedConflict, 
  onSelectConflict 
}: ConflictPanelProps) {
  if (conflicts.length === 0) return null;

  // Group conflicts by type
  const workloadConflicts = conflicts.filter((c) => c.type === "workload");
  const doubleBookingConflicts = conflicts.filter((c) => c.type === "double_booking");
  const classConflicts = conflicts.filter((c) => c.type === "class_overload");
  const missingConflicts = conflicts.filter((c) => c.type === "missing_teacher" || c.type === "unallocated_subject");

  const renderSeverityBadge = (severity: Conflict["severity"]) => {
    switch (severity) {
      case "critical":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            Critical
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Warning
          </span>
        );
      case "info":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Info className="w-3.5 h-3.5 mr-1" />
            Info
          </span>
        );
    }
  };

  const renderConflictCard = (conflict: Conflict) => {
    const isSelected = selectedConflict?.id === conflict.id;

    return (
      <div
        key={conflict.id}
        onClick={() => onSelectConflict(isSelected ? null : conflict)}
        className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left ${
          isSelected 
            ? "border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-600/20" 
            : "border-slate-100 bg-white hover:border-slate-300 shadow-sm"
        }`}
      >
        <div className="flex items-start justify-between space-x-2">
          <p className={`text-sm font-semibold leading-relaxed ${isSelected ? "text-indigo-950" : "text-slate-900"}`}>
            {conflict.message}
          </p>
          <div className="flex-shrink-0">
            {renderSeverityBadge(conflict.severity)}
          </div>
        </div>

        {/* Suggestion engine detailed view */}
        <div className="mt-3 text-xs bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="mb-1.5">
            <span className="font-bold text-slate-700">Issue: </span>
            <span className="text-slate-600">{conflict.suggestion.issue}</span>
          </div>
          <div className="mb-1.5">
            <span className="font-bold text-slate-700">Cause: </span>
            <span className="text-slate-600">{conflict.suggestion.cause}</span>
          </div>
          <div>
            <span className="font-bold text-slate-700">Suggested Fix: </span>
            <span className="text-indigo-700 font-semibold">{conflict.suggestion.suggestedFix}</span>
          </div>
        </div>

        <div className="mt-2 text-[10px] font-bold text-indigo-600/80 flex items-center justify-end">
          {isSelected ? "✨ Actively Highlighting Affected Items" : "🔍 Click to Highlight Affected Items"}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner mb-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">⚠️ Timetable Conflict Inspector</h2>
          <p className="text-xs text-slate-400 mt-1">
            Auditing conflicts in school schedules and resources. Select any item to trace.
          </p>
        </div>
        {selectedConflict && (
          <button
            onClick={() => onSelectConflict(null)}
            className="flex items-center text-xs font-bold bg-white hover:bg-slate-100 text-indigo-700 px-3 py-1.5 rounded-lg border shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Clear Selection
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* double_booking: Teacher double bookings */}
        {doubleBookingConflicts.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-500 mb-3">
              🚨 Double Booking Conflicts ({doubleBookingConflicts.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doubleBookingConflicts.map(renderConflictCard)}
            </div>
          </div>
        )}

        {/* workload: Workload limit conflicts */}
        {workloadConflicts.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-500 mb-3">
              ⚡ Workload Limit Warnings ({workloadConflicts.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workloadConflicts.map(renderConflictCard)}
            </div>
          </div>
        )}

        {/* class_overload: Class overload conflicts */}
        {classConflicts.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-500 mb-3">
              🏫 Class Overload Violations ({classConflicts.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classConflicts.map(renderConflictCard)}
            </div>
          </div>
        )}

        {/* missing/unallocated: Missing Assignments & Unallocated Subjects */}
        {missingConflicts.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-500 mb-3">
              📝 Missing Assignments & Unallocated Subjects ({missingConflicts.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {missingConflicts.map(renderConflictCard)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
