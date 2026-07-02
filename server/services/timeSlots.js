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
  const start = toMinutes(settings.startTime);

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

  let current = start;

  const slots = [];

  for (let period = 1; period <= periodsPerDay; period++) {
    const startTime = current;
    const endTime = current + periodDuration;

    slots.push({
      type: "PERIOD",
      period,
      start: toTime(startTime),
      end: toTime(endTime),
      label: `Period ${period}`,
    });

    current = endTime;

    const breakIndex = breakPositions.indexOf(period);

    if (breakIndex !== -1) {
      const duration = breakDurations[breakIndex] || 10;

      slots.push({
        type: "BREAK",
        start: toTime(current),
        end: toTime(current + duration),
        label: "Short Break",
      });

      current += duration;
    }

    if (period === lunchPosition) {
      slots.push({
        type: "LUNCH",
        start: toTime(current),
        end: toTime(current + lunchDuration),
        label: "Lunch",
      });

      current += lunchDuration;
    }
  }

  return slots;
}

export default buildTimeSlots;