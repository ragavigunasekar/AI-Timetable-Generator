import type { SchoolSettings, TimelineEvent } from "../../types/SchoolSettings";

export function formatTimeLabel(value: string) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function toMinutes(timeStr: string) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function toTime(minutes: number) {
  const norm = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface ClientSlot {
  id: string;
  type: "fixed" | "teaching";
  label: string;
  start: string;
  end: string;
  period?: number;
  eventType?: string;
  icon?: string;
  color?: string;
  isTeachingBlocked?: boolean;
}

/**
 * Converts legacy settings fields to timeline events for backward compatibility.
 * This is ONLY invoked when settings.timelineEvents is absent or empty.
 * The UI never sets legacy fields — they only persist from old DB records.
 */
function convertLegacyToTimelineEvents(settings: SchoolSettings): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const startMins = toMinutes(settings?.startTime || "08:45");
  const periodDuration = Number(settings?.periodDuration) || 45;
  const periodsPerDay = Number(settings?.periodsPerDay) || 8;
  const lunchDuration = Number(settings?.lunchDuration) || 45;
  const lunchPosition = Number(settings?.lunchPosition) || 0;
  const assemblyPeriod = Number(settings?.assemblyPeriod) || 0;
  const prayerPeriod = Number(settings?.prayerPeriod) || 0;

  const breakPositions = ((settings as any)?.breakPositions || "")
    .split(",")
    .map((x: string) => Number(x.trim()))
    .filter((x: number) => !isNaN(x) && x > 0);

  const breakDurations = ((settings as any)?.breakDurations || "")
    .split(",")
    .map((x: string) => Number(x.trim()));

  let curr = startMins;

  for (let p = 1; p <= periodsPerDay; p++) {
    if (assemblyPeriod === p) {
      events.push({
        id: `legacy-assembly-${p}`,
        title: "Assembly",
        type: "assembly",
        startTime: toTime(curr),
        endTime: toTime(curr + 20),
        icon: "School",
        isTeachingBlocked: true,
      });
      curr += 20;
    }

    if (prayerPeriod === p) {
      events.push({
        id: `legacy-prayer-${p}`,
        title: "Prayer",
        type: "prayer",
        startTime: toTime(curr),
        endTime: toTime(curr + 15),
        icon: "Landmark",
        isTeachingBlocked: true,
      });
      curr += 15;
    }

    curr += periodDuration;

    const breakIdx = breakPositions.indexOf(p);
    if (breakIdx !== -1) {
      const dur = breakDurations[breakIdx] || Number((settings as any)?.shortBreakDuration) || 10;
      events.push({
        id: `legacy-break-${p}`,
        title: "Short Break",
        type: "break",
        startTime: toTime(curr),
        endTime: toTime(curr + dur),
        icon: "Coffee",
        isTeachingBlocked: true,
      });
      curr += dur;
    }

    if (lunchPosition === p && lunchDuration > 0) {
      events.push({
        id: `legacy-lunch-${p}`,
        title: "Lunch Break",
        type: "lunch",
        startTime: toTime(curr),
        endTime: toTime(curr + lunchDuration),
        icon: "Utensils",
        isTeachingBlocked: true,
      });
      curr += lunchDuration;
    }
  }

  return events;
}

/**
 * Returns effective timeline events for the given settings.
 * Primary source: settings.timelineEvents
 * Fallback: legacy field migration (for old DB records only)
 */
export function getEffectiveTimelineEvents(settings: SchoolSettings): TimelineEvent[] {
  if (Array.isArray(settings?.timelineEvents) && settings.timelineEvents.length > 0) {
    return settings.timelineEvents.filter(
      (e) => e && (e.title || e.name) && e.startTime && e.endTime
    );
  }

  // Backward-compat fallback: convert legacy DB fields to timeline events
  return convertLegacyToTimelineEvents(settings);
}

/**
 * Builds the full daily slot list from settings.
 * Fixed events (timeline events) appear as locked rows.
 * Teaching periods are derived dynamically from remaining free windows.
 */
export function buildTimeSlots(settings: SchoolSettings, day?: string): ClientSlot[] {
  const startMins = toMinutes(settings?.startTime || "08:45");
  const endMins = toMinutes(settings?.endTime || "16:00");
  const periodDuration = Math.max(15, Number(settings?.periodDuration) || 45);

  let rawEvents = getEffectiveTimelineEvents(settings);
  if (day) {
    rawEvents = rawEvents.filter(
      (evt) => !evt.days || evt.days.length === 0 || evt.days.includes(day)
    );
  }

  const parsedEvents = rawEvents
    .map((evt) => ({
      ...evt,
      startMins: toMinutes(evt.startTime),
      endMins: toMinutes(evt.endTime),
    }))
    .filter((evt) => evt.startMins < evt.endMins && evt.endMins > startMins && evt.startMins < endMins)
    .sort((a, b) => a.startMins - b.startMins);

  const slots: ClientSlot[] = [];
  let currentMins = startMins;
  let periodCounter = 1;

  while (currentMins < endMins) {
    const activeEvent = parsedEvents.find(
      (evt) => evt.startMins <= currentMins && evt.endMins > currentMins
    );

    if (activeEvent) {
      slots.push({
        id: activeEvent.id,
        type: "fixed",
        label: activeEvent.title || activeEvent.name || "Event",
        eventType: activeEvent.type,
        start: formatTimeLabel(toTime(activeEvent.startMins)),
        end: formatTimeLabel(toTime(activeEvent.endMins)),
        icon: activeEvent.icon,
        color: activeEvent.color,
        isTeachingBlocked: activeEvent.isTeachingBlocked !== false,
      });
      currentMins = activeEvent.endMins;
      continue;
    }

    const nextEvent = parsedEvents.find((evt) => evt.startMins > currentMins);
    const windowEndMins = nextEvent ? Math.min(endMins, nextEvent.startMins) : endMins;
    const availableWindow = windowEndMins - currentMins;

    if (availableWindow >= periodDuration) {
      const slotEndMins = currentMins + periodDuration;
      slots.push({
        id: `period-${periodCounter}`,
        type: "teaching",
        period: periodCounter,
        label: `Period ${periodCounter}`,
        start: formatTimeLabel(toTime(currentMins)),
        end: formatTimeLabel(toTime(slotEndMins)),
      });
      periodCounter++;
      currentMins = slotEndMins;
    } else {
      currentMins = windowEndMins;
    }
  }

  // Fallback to basic slots if none generated
  if (slots.length === 0) {
    const periodsPerDay = Number(settings?.periodsPerDay) || 8;
    for (let p = 1; p <= periodsPerDay; p++) {
      slots.push({
        id: `period-${p}`,
        type: "teaching",
        period: p,
        label: `Period ${p}`,
        start: formatTimeLabel(toTime(startMins + (p - 1) * periodDuration)),
        end: formatTimeLabel(toTime(startMins + p * periodDuration)),
      });
    }
  }

  return slots;
}
