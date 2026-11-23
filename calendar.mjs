export const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
export const calendars = {
  work: "仕事",
  personal: "自分",
  family: "家族",
  outing: "おでかけ",
};

export function dayKey(date = new Date()) {
  return [date.getFullYear().toString().padStart(4, "0"), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0")).join("-");
}

export function dateOf(key) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date;
}

export function plusDays(key, days) {
  const date = dateOf(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

export function move(key, amount, view) {
  if (view === "day" || view === "week") return plusDays(key, view === "week" ? amount * 7 : amount);
  const date = dateOf(key);
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  const last = new Date(date);
  last.setMonth(last.getMonth() + 1, 0);
  date.setDate(Math.min(originalDay, last.getDate()));
  return dayKey(date);
}

export function weekDays(key, firstDay) {
  const offset = (dateOf(key).getDay() - firstDay + 7) % 7;
  return Array.from({ length: 7 }, (_, index) => plusDays(key, index - offset));
}

export function monthWeeks(key, firstDay) {
  const month = key.slice(0, 7);
  const first = weekDays(month + "-01", firstDay)[0];
  const weeks = [];
  for (let start = first; start < move(month + "-01", 1, "month"); start = plusDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => plusDays(start, index)));
  }
  return weeks;
}

export function lastVisibleDay(event) {
  if (!event.allDay && event.endTime === "00:00" && event.endDate > event.startDate) {
    return plusDays(event.endDate, -1);
  }
  return event.endDate;
}

export function eventOrder(a, b) {
  return a.startDate.localeCompare(b.startDate) || Number(b.allDay) - Number(a.allDay) ||
    a.startTime.localeCompare(b.startTime) || b.endDate.localeCompare(a.endDate) || a.id.localeCompare(b.id);
}

export function eventsOn(events, day) {
  return events.filter((event) => event.startDate <= day && day <= lastVisibleDay(event)).sort(eventOrder);
}

export function weekLayout(days, events, rows = 3) {
  const used = Array.from({ length: rows }, () => Array(7).fill(false));
  const overflow = Array(7).fill(0);
  const entries = [];
  const last = (event) => lastVisibleDay(event);
  const relevant = events.filter((event) => event.startDate <= days[6] && last(event) >= days[0]);
  relevant.sort((a, b) =>
    Number(b.startDate !== last(b)) - Number(a.startDate !== last(a)) || eventOrder(a, b));
  for (const event of relevant) {
    const end = last(event);
    const firstColumn = days.findIndex((day) => day >= event.startDate);
    const lastColumn = days.findLastIndex((day) => day <= end);
    const columns = Array.from({ length: lastColumn - firstColumn + 1 }, (_, index) => firstColumn + index);
    const row = used.findIndex((line) => columns.every((col) => !line[col]));
    if (row === -1) {
      columns.forEach((col) => overflow[col]++);
      continue;
    }
    columns.forEach((col) => { used[row][col] = true; });
    entries.push({ event, row, firstColumn, lastColumn, band: event.startDate !== end || event.allDay });
  }
  return { entries, overflow };
}

export function validEvent(event) {
  const keyIsValid = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && dayKey(dateOf(key)) === key;
  const timeIsValid = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!event.title.trim() || !Object.hasOwn(calendars, event.calendar)) return false;
  if (!keyIsValid(event.startDate) || !keyIsValid(event.endDate) || event.endDate < event.startDate) return false;
  return event.allDay || (timeIsValid(event.startTime) && timeIsValid(event.endTime) &&
    (event.endDate > event.startDate || event.endTime > event.startTime));
}

export function seed(today) {
  const month = today.slice(0, 7);
  const nextMonth = move(month + "-01", 1, "month");
  const events = [];
  const add = (title, calendar, startDate, startTime, endTime, endDate = startDate) => {
    events.push({ id: "sample-" + events.length, title, calendar, startDate, endDate,
      allDay: !startTime, startTime: startTime || "09:00", endTime: endTime || "10:00",
      location: "", notes: "", sample: true });
  };
  add("月初の打ち合わせ", "work", month + "-02", "09:00", "10:00");
  add("本の返却", "personal", month + "-04", "", "");
  add("友人とランチ", "family", month + "-06", "12:30", "14:00");
  add("小旅行", "outing", month + "-08", "", "", month + "-11");
  add("資料の締め切り", "work", month + "-12", "15:00", "16:00");
  add("家族と夕食", "family", month + "-15", "18:00", "19:30");
  add("読書の記録", "personal", today, "", "");
  add("定例ミーティング", "work", today, "10:00", "11:00");
  add("買い物", "family", today, "18:00", "18:45");
  add("図書館に寄る", "personal", month + "-23", "11:00", "12:00");
  add("展示会", "outing", month + "-25", "", "", month + "-27");
  add("帰省", "family", plusDays(nextMonth, -2), "", "", plusDays(nextMonth, 1));
  return { events, tasks: [], settings: { firstDay: 1, largeText: false, hidden: [] } };
}
