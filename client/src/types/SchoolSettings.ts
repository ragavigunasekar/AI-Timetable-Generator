export interface TimelineEvent {
  id: string;
  title: string;
  name?: string; // Legacy alias for title
  type: string;  // e.g. 'assembly' | 'lunch' | 'break' | 'sports' | 'prayer' | 'exam' | 'club' | 'meeting' | 'custom'
  startTime: string; // 'HH:mm' format e.g. '12:40'
  endTime: string;   // 'HH:mm' format e.g. '13:20'
  color?: string;
  icon?: string;     // Lucide icon key (e.g. 'School', 'Utensils', 'Coffee', 'Dumbbell', etc.)
  isRecurring?: boolean;
  days?: string[];   // Array of working days e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  isTeachingBlocked?: boolean; // Default true (reserves slot against teacher & class assignments)
}

export interface SchoolSettings {
  userId?: number;
  schoolName: string;
  academicYear?: string;

  // School Timing
  startTime: string;
  endTime: string;

  // Academic Structure
  periodsPerDay: string;
  periodDuration: string;

  // Working Days
  workingDays: string;

  // Unified Daily Timeline Events
  timelineEvents?: TimelineEvent[];

  // Legacy fields retained for backward compatibility / database migrations
  shortBreaks?: string;
  shortBreakDuration?: string;
  lunchDuration?: string;
  lunchPosition?: string;
  assemblyPeriod?: string;
  prayerPeriod?: string;
  breakPositions?: string;
  breakDurations?: string;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}
