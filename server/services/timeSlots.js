/**
 * Time Slot Engine
 * ----------------
 * Generates the complete daily schedule using the school settings.
 *
 * Example:
 *
 * 08:45 - 09:30  Period 1
 * 09:30 - 10:15  Period 2
 * 10:15 - 10:25  Break
 * 10:25 - 11:10  Period 3
 * ...
 */

function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function buildTimeSlots(settings) {
  const start = toMinutes(settings.startTime || '08:00');
  const end = toMinutes(settings.endTime || '15:00');
  const periodDuration = Number(settings.periodDuration) || 45;
  const periodsPerDay = Number(settings.periodsPerDay) || 8;
  const lunchDuration = Number(settings.lunchDuration) || 45;
  const lunchPosition = Number(settings.lunchPosition) || 5;

  const breakPositions = (settings.breakPositions || "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter(Boolean);

  const breakDurations = (settings.breakDurations || "")
    .split(",")
    .map((x) => Number(x.trim()));

  const timelineEvents = Array.isArray(settings.timelineEvents)
    ? settings.timelineEvents.filter(Boolean)
    : [];

  let current = start;
  const slots = [];

  const pushFixedEvent = (event) => {
    if (!event?.name || !event?.startTime || !event?.endTime) return;
    const startTime = toMinutes(event.startTime);
    const endTime = toMinutes(event.endTime);
    if (startTime < current || endTime <= startTime) return;
    if (startTime > end) return;
    slots.push({
      type: 'fixed',
      label: event.name,
      start: toTime(startTime),
      end: toTime(endTime),
      eventType: event.type || 'custom',
      source: 'timeline',
    });
  };

  timelineEvents.forEach(pushFixedEvent);

  const fixedRanges = timelineEvents
    .filter((event) => event?.startTime && event?.endTime)
    .map((event) => ({
      start: toMinutes(event.startTime),
      end: toTime ? toMinutes(event.endTime) : toMinutes(event.endTime),
    }));

  const isWithinFixedRange = (candidateStart, candidateEnd) => fixedRanges.some((range) => candidateStart < range.end && candidateEnd > range.start);

  for (let period = 1; period <= periodsPerDay; period++) {
    const startTime = current;
    const endTime = current + periodDuration;

    if (endTime <= end && !isWithinFixedRange(startTime, endTime)) {
      slots.push({
        type: 'teaching',
        period,
        start: toTime(startTime),
        end: toTime(endTime),
        label: `Teaching Slot ${period}`,
      });
    }

    current = endTime;

    const breakIndex = breakPositions.indexOf(period);

    if (breakIndex !== -1) {
      const duration = breakDurations[breakIndex] || 10;
      const breakStart = current;
      const breakEnd = breakStart + duration;
      if (breakEnd <= end && !isWithinFixedRange(breakStart, breakEnd)) {
        slots.push({
          type: 'fixed',
          start: toTime(breakStart),
          end: toTime(breakEnd),
          label: 'Short Break',
          eventType: 'break',
          source: 'legacy',
        });
      }
      current = breakEnd;
    }

    if (period === lunchPosition) {
      const lunchStart = current;
      const lunchEnd = lunchStart + lunchDuration;
      if (lunchEnd <= end && !isWithinFixedRange(lunchStart, lunchEnd)) {
        slots.push({
          type: 'fixed',
          start: toTime(lunchStart),
          end: toTime(lunchEnd),
          label: 'Lunch',
          eventType: 'lunch',
          source: 'legacy',
        });
      }
      current = lunchEnd;
    }
  }

  return slots;
}

export default buildTimeSlots;