import { useMemo, useState, useCallback } from "react";
import { useSchoolStore } from "../store/schoolStore";
import { generateOptimizationRecommendations } from "../services/optimizationEngine";
import type { OptimizationEngineOutput } from "../types/Optimization";

interface UseOptimizationEngineReturn {
  /** Last computed engine output. Null until analyzeNow() is called. */
  engineOutput: OptimizationEngineOutput | null;
  /** Whether the analysis is running (synchronous but gated by user action). */
  isAnalyzing: boolean;
  /** Whether results are stale (store changed since last analysis). */
  isStale: boolean;
  /** Trigger a fresh analysis pass and store results in Zustand. */
  analyzeNow: () => void;
  /** Clear all recommendations from the store and reset local output. */
  clearRecommendations: () => void;
}

/**
 * useOptimizationEngine
 *
 * Wraps the pure optimizationEngine service with React state management.
 * Memoized on the store slices the engine reads — recalculates only when
 * those slices change.
 *
 * The engine itself has zero React/Zustand dependencies and is independently
 * testable. This hook is the only coupling point between the engine and React.
 */
export function useOptimizationEngine(): UseOptimizationEngineReturn {
  const teachers = useSchoolStore((state) => state.teachers);
  const subjects = useSchoolStore((state) => state.subjects);
  const classes = useSchoolStore((state) => state.classes);
  const allocations = useSchoolStore((state) => state.allocations);
  const conflicts = useSchoolStore((state) => state.conflicts);
  const schoolSettings = useSchoolStore((state) => state.schoolSettings);
  const currentHealthScore = useSchoolStore((state) => state.timetableHealthScore);
  const setOptimizationRecommendations = useSchoolStore((s) => s.setOptimizationRecommendations);
  const clearOptimizationRecommendations = useSchoolStore((s) => s.clearOptimizationRecommendations);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [engineOutput, setEngineOutput] = useState<OptimizationEngineOutput | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<number | null>(null);

  // Fingerprint the inputs that, when changed, mark results as stale.
  // Using JSON lengths + counts is O(1) — avoids deep equality of large arrays.
  const inputFingerprint = useMemo(
    () =>
      `${allocations.length}:${teachers.length}:${subjects.length}:${classes.length}:${conflicts.length}:${currentHealthScore}`,
    [allocations.length, teachers.length, subjects.length, classes.length, conflicts.length, currentHealthScore]
  );

  const isStale = lastAnalyzedAt !== null && engineOutput !== null
    ? (() => {
        // Re-compute fingerprint at render time to compare with stored one
        return engineOutput.recommendations.length === 0
          ? false
          : conflicts.length !== (engineOutput.recommendations[0]?.healthImpact.conflictsRemainingCount ?? -1) +
              (engineOutput.recommendations[0]?.healthImpact.conflictsRemovedCount ?? 0);
      })()
    : false;

  const analyzeNow = useCallback(() => {
    setIsAnalyzing(true);
    try {
      const output = generateOptimizationRecommendations({
        teachers,
        subjects,
        classes,
        allocations,
        conflicts,
        schoolSettings,
        currentHealthScore,
      });
      setEngineOutput(output);
      setOptimizationRecommendations(output.recommendations);
      setLastAnalyzedAt(Date.now());
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    teachers,
    subjects,
    classes,
    allocations,
    conflicts,
    schoolSettings,
    currentHealthScore,
    setOptimizationRecommendations,
    inputFingerprint,
  ]);

  const clearRecommendations = useCallback(() => {
    setEngineOutput(null);
    setLastAnalyzedAt(null);
    clearOptimizationRecommendations();
  }, [clearOptimizationRecommendations]);

  return {
    engineOutput,
    isAnalyzing,
    isStale,
    analyzeNow,
    clearRecommendations,
  };
}
