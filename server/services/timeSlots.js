/**
 * Time Slot Engine
 * ----------------
 * Dynamically builds daily timeline schedules and teaching slots based on Daily Timeline Events.
 * Reserved events are treated as immutable blocks and teaching periods are derived around them.
 */

export function toMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
  return parts[0] * 60 + parts[1];
}

export function toTime(minutes) {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function convertLegacySettingsToEvents(settings) {
  if (!settings) return [];
  const events = [];
  const startTimeMins = toMinutes(settings.startTime || "08:45");
  const periodDuration = Number(settings.periodDuration) || 45;
  const periodsPerDay = Number(settings.periodsPerDay) || 8;
  const lunchDuration = Number(settings.lunchDuration) || 45;
  const lunchPosition = Number(settings.lunchPosition) || 0;
  const assemblyPeriod = Number(settings.assemblyPeriod) || 0;
  const prayerPeriod = Number(settings.prayerPeriod) || 0;

  const breakPositions = (settings.breakPositions || "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => !isNaN(x) && x > 0);

  const breakDurations = (settings.breakDurations || "")
    .split(",")
    .map((x) => Number(x.trim()));

  let curr = startTimeMins;

  for (let p = 1; p <= periodsPerDay; p++) {
    if (assemblyPeriod === p) {
      events.push({
        id: `legacy-assembly-${p}`,
        title: "Assembly",
        type: "assembly",
        startTime: toTime(curr),
        endTime: toTime(curr + 20),
        isTeachingBlocked: true,
        icon: "School",
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
        isTeachingBlocked: true,
        icon: "Landmark",
      });
      curr += 15;
    }

    curr += periodDuration;

    const breakIdx = breakPositions.indexOf(p);
    if (breakIdx !== -1) {
      const dur = breakDurations[breakIdx] || Number(settings.shortBreakDuration) || 10;
      events.push({
        id: `legacy-break-${p}`,
        title: "Short Break",
        type: "break",
        startTime: toTime(curr),
        endTime: toTime(curr + dur),
        isTeachingBlocked: true,
        icon: "Coffee",
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
        isTeachingBlocked: true,
        icon: "Utensils",
      });
      curr += lunchDuration;
    }
  }

  return events;
}

export function getEffectiveTimelineEvents(settings) {
  if (!settings) return [];
  let events = [];
  if (Array.isArray(settings.timelineEvents) && settings.timelineEvents.length > 0) {
    events = settings.timelineEvents.filter(
      (e) => e && (e.title || e.name) && e.startTime && e.endTime
    );
  }

  if (events.length === 0) {
    events = convertLegacySettingsToEvents(settings);
  }

  return events.map((e, idx) => ({
    id: e.id || `evt-${idx + 1}`,
    title: e.title || e.name || "Event",
    type: e.type || "custom",
    startTime: e.startTime,
    endTime: e.endTime,
    color: e.color || "#6366f1",
    icon: e.icon || "Clock",
    isRecurring: e.isRecurring !== false,
    days: Array.isArray(e.days) ? e.days : [],
    isTeachingBlocked: e.isTeachingBlocked !== false,
  }));
}

export function buildTimeSlots(settings, day = null) {
  const startMins = toMinutes(settings.startTime || "08:45");
  const endMins = toMinutes(settings.endTime || "16:00");
  const periodDuration = Math.max(1, Number(settings.periodDuration) || 45);

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

  const slots = [];
  let currentMins = startMins;
  let slotIndex = 0;

  while (currentMins < endMins) {
    const activeEvent = parsedEvents.find(
      (evt) => evt.startMins <= currentMins && evt.endMins > currentMins
    );

    if (activeEvent) {
      slotIndex += 1;
      slots.push({
        id: activeEvent.id,
        type: "fixed",
        period: slotIndex,
        label: activeEvent.title,
        title: activeEvent.title,
        eventType: activeEvent.type,
        start: toTime(activeEvent.startMins),
        end: toTime(activeEvent.endMins),
        startMins: activeEvent.startMins,
        endMins: activeEvent.endMins,
        isTeachingBlocked: activeEvent.isTeachingBlocked,
        icon: activeEvent.icon,
        color: activeEvent.color,
      });
      currentMins = activeEvent.endMins;
      continue;
    }

    const nextEvent = parsedEvents.find((evt) => evt.startMins > currentMins);
    const windowEndMins = nextEvent ? Math.min(endMins, nextEvent.startMins) : endMins;
    const availableWindow = windowEndMins - currentMins;

    if (availableWindow >= periodDuration) {
      const slotEndMins = currentMins + periodDuration;
      slotIndex += 1;
      slots.push({
        id: `period-${slotIndex}`,
        type: "teaching",
        period: slotIndex,
        label: `Period ${slotIndex}`,
        start: toTime(currentMins),
        end: toTime(slotEndMins),
        startMins: currentMins,
        endMins: slotEndMins,
      });
      currentMins = slotEndMins;
    } else {
      currentMins = windowEndMins;
    }
  }

  return slots;
}

export default buildTimeSlots;