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

  // Break Configuration
  shortBreaks: string;
  shortBreakDuration: string;

  // Lunch Configuration
  lunchDuration: string;
  lunchPosition: string;

  // Optional Activities
  assemblyPeriod: string;
  prayerPeriod: string;

  // Advanced Break Support
  breakPositions?: string;
  breakDurations?: string;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}
