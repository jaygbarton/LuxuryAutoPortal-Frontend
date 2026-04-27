/**
 * Work schedule calendar – same logic as v1 getArrayTotalDaysInMonthAndYear.
 * dateVal = "YYYY-MM". Returns flat array of day cells (7 per week, Sun–Sat).
 */

export const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface DayCell {
  day: number;
  currentDay: number;
  week_name: string;
  date: Date;
  originalDate: string;
  originalDateCode: string;
  year: number;
  month: string;
  week: number;
  isPreviousMonth: boolean;
  isNextMonth: boolean;
}

function getWeekName(dayIndex: number): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[dayIndex] ?? "";
}

export function getMonthYearNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getArrayTotalDaysInMonthAndYear(dateVal: string): DayCell[] {
  const totalDaysPerMonth: DayCell[] = [];
  let currentWeek = 1;
  const [yStr, mStr] = dateVal.split("-");
  const dateFullYear = parseInt(yStr, 10);
  const monthNumber = parseInt(mStr, 10);
  const endOfMonth = new Date(dateFullYear, monthNumber, 0).getDate();
  const month = String(monthNumber).padStart(2, "0");

  for (let i = 0; i < endOfMonth; i++) {
    const dayNum = i + 1;
    const dayOfWeek = new Date(dateFullYear, monthNumber - 1, dayNum).getDay();
    const date = String(dayNum).padStart(2, "0");
    totalDaysPerMonth.push({
      day: dayNum,
      currentDay: dayOfWeek,
      week_name: getWeekName(dayOfWeek),
      date: new Date(dateFullYear, monthNumber - 1, dayNum),
      originalDate: `${dateFullYear}-${month}-${date}`,
      originalDateCode: `${dateFullYear}${month}${date}`,
      year: dateFullYear,
      month,
      week: currentWeek,
      isPreviousMonth: false,
      isNextMonth: false,
    });
    if (dayOfWeek === 6) currentWeek++;
  }

  const getAllDaysInFirstWeek = totalDaysPerMonth.filter((item) => item.week === 1);
  const weekNumber = Math.ceil((endOfMonth + new Date(dateFullYear, monthNumber - 1, endOfMonth).getDay()) / 7);
  const getAllDaysInLastWeek = totalDaysPerMonth.filter((item) => item.week === weekNumber);

  const firstWeek: DayCell[] = [];
  for (let i = 0; i < 7 - getAllDaysInFirstWeek.length; i++) {
    firstWeek.push({
      day: 0,
      currentDay: i,
      week_name: getWeekName(i),
      date: new Date(NaN),
      originalDate: "",
      originalDateCode: "",
      year: dateFullYear,
      month,
      week: 1,
      isPreviousMonth: true,
      isNextMonth: false,
    });
  }

  let lastWeek: DayCell[] = [];
  const getLastWeekCount = totalDaysPerMonth.length > 0 ? totalDaysPerMonth[endOfMonth - 1].week : weekNumber;
  const currentDateLastDay = new Date(dateFullYear, monthNumber - 1, endOfMonth).getDay();
  const lastWeekdayCount = currentDateLastDay + 1;
  const lastDayCount = 7 - lastWeekdayCount;
  if (lastDayCount > 0) {
    for (let i = 0; i < lastDayCount; i++) {
      const countTotal = weekNumber + i;
      const countWeek = countTotal === 7 ? 0 : countTotal;
      lastWeek.push({
        day: 0,
        currentDay: countWeek,
        week_name: getWeekName(countWeek),
        date: new Date(NaN),
        originalDate: "",
        originalDateCode: "",
        year: dateFullYear,
        month,
        week: getLastWeekCount,
        isPreviousMonth: false,
        isNextMonth: true,
      });
    }
  }

  return [...firstWeek, ...totalDaysPerMonth, ...lastWeek];
}

export function getWeeksCount(dayCells: DayCell[]): number {
  if (dayCells.length === 0) return 0;
  const last = dayCells[dayCells.length - 1];
  return last.week;
}

/** Build a 7-cell row (Sun=0 .. Sat=6) for the given week. Fills missing with empty placeholder. */
export function getWeekRow(dayCells: DayCell[], weekNum: number): DayCell[] {
  const weekCells = dayCells.filter((c) => c.week === weekNum);
  const empty = (currentDay: number): DayCell => ({
    day: 0,
    currentDay,
    week_name: getWeekName(currentDay),
    date: new Date(NaN),
    originalDate: "",
    originalDateCode: "",
    year: weekCells[0]?.year ?? 0,
    month: weekCells[0]?.month ?? "",
    week: weekNum,
    isPreviousMonth: false,
    isNextMonth: false,
  });
  return [0, 1, 2, 3, 4, 5, 6].map(
    (d) => weekCells.find((c) => c.currentDay === d) ?? empty(d)
  );
}

export function isToday(dateCode: string): boolean {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const todayCode = `${y}${m}${day}`;
  return dateCode === todayCode;
}

export function formatDateForDisplay(originalDate: string): string {
  if (!originalDate) return "--";
  const [y, m, d] = originalDate.split("-");
  if (!y || !m || !d) return originalDate;
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
