import buildTimeSlots from "./timeSlots.js";

const settings = {
  startTime: "08:45",
  periodDuration: "45",
  periodsPerDay: "8",

  lunchDuration: "45",
  lunchPosition: "5",

  breakPositions: "2,7",
  breakDurations: "10,10",
};

console.table(buildTimeSlots(settings));