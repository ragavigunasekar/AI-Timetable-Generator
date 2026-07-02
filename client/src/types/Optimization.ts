// ─── Optimization Domain Types ────────────────────────────────────────────────
// Designed for extensibility: future modules (Room Optimization, Lab Scheduling,
// Teacher Availability, Consecutive Period Rules, Subject Spread Optimization)
// plug in by adding new OptimizationType values without changing the UI contracts.

export type OptimizationType =
  | "workload_rebalancing"
  | "class_overload_reduction"
  | "missing_teacher_assignment"
  | "subject_distribution_balancing"
  | "capacity_optimization"
  // Reserved for future modules — do not implement in Phase 1
  | "room_optimization"
  | "lab_scheduling"
  | "teacher_availability"
  | "consecutive_period_rules"
  | "subject_spread_optimization";

export type OptimizationPriority = "critical" | "high" | "medium" | "low";

export type OptimizationEffort = "low" | "medium" | "high";

// ─── Affected Entity ──────────────────────────────────────────────────────────

export interface AffectedEntity {
  entityId: string;
  entityName: string;
  entityType: "teacher" | "class" | "subject" | "allocation";
}

// ─── Implementation Strategy ──────────────────────────────────────────────────
// Carries structured data for both manual guidance and future auto-apply.
// Phase 1: All changes require explicit user confirmation via Preview Modal.

export type StrategyAction =
  | "reassign_teacher"
  | "reduce_periods"
  | "assign_teacher"
  | "create_allocation"
  | "redistribute_load"
  | "redistribute_subjects"
  | "review_capacity";

export interface ImplementationStrategy {
  action: StrategyAction;
  /** Human-readable step-by-step instructions shown in Preview Mode. */
  steps: string[];
  /** Allocation IDs that would be mutated if the user confirms. */
  targetAllocationIds: string[];
  /** Teacher ID suggested for assignment (informational only in Phase 1). */
  suggestedTeacherId?: string;
  /** If set, the proposed period delta for the affected allocations. */
  suggestedPeriodDelta?: number;
}

// ─── Health Impact Analysis ───────────────────────────────────────────────────

export interface HealthImpactAnalysis {
  currentHealthScore: number;
  estimatedNewHealthScore: number;
  estimatedHealthIncrease: number;
  conflictsRemovedCount: number;
  conflictsRemainingCount: number;
  /** IDs of existing Conflict objects this recommendation would resolve. */
  conflictIdsResolved: string[];
}

// ─── Core Recommendation ─────────────────────────────────────────────────────

export interface OptimizationRecommendation {
  id: string;
  type: OptimizationType;
  title: string;
  description: string;
  priority: OptimizationPriority;
  effort: OptimizationEffort;
  /** 0–100. Higher = engine is more confident this fix resolves the issue. */
  confidenceScore: number;
  affectedEntities: AffectedEntity[];
  healthImpact: HealthImpactAnalysis;
  implementationStrategy: ImplementationStrategy;
  /**
   * Phase 1: always false. Reserved for future auto-apply capability once
   * teacher availability and specialization confidence are modeled.
   */
  isAutoApplicable: false;
}

// ─── Engine Input ─────────────────────────────────────────────────────────────
// Mirrors the relevant slices of schoolStore without importing it.
// Keeps the engine independently testable.

import type { Teacher } from "./Teacher";
import type { Subject } from "./Subject";
import type { SchoolClass } from "./Class";
import type { Allocation } from "./Allocation";
import type { SchoolSettings } from "./SchoolSettings";
import type { Conflict } from "../store/schoolStore";

export interface OptimizationEngineInput {
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
  allocations: Allocation[];
  conflicts: Conflict[];
  schoolSettings: SchoolSettings;
  currentHealthScore: number;
}

// ─── Engine Output ────────────────────────────────────────────────────────────

export interface OptimizationEngineOutput {
  recommendations: OptimizationRecommendation[];
  /** Summary computed from all recommendations combined. */
  summary: {
    totalRecommendations: number;
    maxHealthGain: number;
    criticalCount: number;
    highCount: number;
  };
}
