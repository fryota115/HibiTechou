import {
  calendars, dateOf, dayKey, eventOrder, eventsOn, monthWeeks, move, plusDays, validEvent, weekDays, weekLayout, weekdays,
} from "./calendar.mjs";
import { openStorage, readPlanner, updatePlanner } from "./storage.mjs";

const app = document.querySelector("#app");
const main = document.querySelector("#main");
const sidebar = document.querySelector("#sidebar");
const bottom = document.querySelector("#bottom-nav");
const dialog = document.querySelector("#dialog");
const notice = document.querySelector("#notice");
const tabs = [["day", "日"], ["week", "週"], ["month", "月"], ["tasks", "タスク"], ["settings", "その他"]];
const paths = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18m-13 4h2m4 0h2m-8 3h2"/>',
  day: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',
  week: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18m-12 0v10m6-10v10"/>',
  tasks: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 2.5 2.5L16 9"/>',
  settings: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="9" cy="17" r="2" fill="currentColor"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3m-3 4v2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};
const labels = { tasks: "タスク", settings: "設定" };
const state = {
  today: dayKey(), date: dayKey(), view: "month", lastCalendar: "month", database: null, data: null,
};
const updates = "BroadcastChannel" in window ? new BroadcastChannel("hibi-techou-updates") : null;
let noticeTimer;

const escape = (value) => String(value).replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const icon = (name) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + "</svg>";
const calendarTab = () => ["month", "week", "day"].includes(state.view);
const tabIcon = (name) => icon(name === "month" ? "calendar" : name);
const labelDate = (key) => {
  const date = dateOf(key);
  return (date.getMonth() + 1) + "月" + date.getDate() + "日";
};
const fullDate = (key) => dateOf(key).getFullYear() + "年" + labelDate(key) + " " +
  weekdays[dateOf(key).getDay()] + "曜日";
const dayClass = (key) => ({ 0: "sunday", 6: "saturday" })[dateOf(key).getDay()] || "";
const todayClass = (key) => key === state.today ? " is-today" : "";
const selectedClass = (key) => key === state.date ? " is-selected" : "";
const visibleEvents = () => state.data.events.filter((event) => !state.data.settings.hidden.includes(event.calendar));
const dueTasks = (key) => state.data.tasks.filter((task) => task.due === key && !task.done);

function announce(message) {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.hidden = false;
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 3500);
}

function periodText() {
  const date = dateOf(state.date);
  if (state.view === "month") return date.getFullYear() + "年 " + (date.getMonth() + 1) + "月";
  if (state.view === "week") {
    const days = weekDays(state.date, state.data.settings.firstDay);
    const short = (key) => (dateOf(key).getMonth() + 1) + "/" + dateOf(key).getDate();
    return short(days[0]) + " – " + short(days[6]);
  }
  if (state.view === "day") return labelDate(state.date) + "（" + weekdays[date.getDay()] + "）";
  return labels[state.view];
}

function tabButton(tab, label) {
  const active = tab === state.view;
  return '<button type="button" data-action="tab" data-tab="' + tab + '" aria-pressed="' + active + '">' +
    tabIcon(tab) + "<span>" + label + "</span></button>";
}

function toolbar() {
  return '<header class="toolbar"><div class="period-group">' +
    (calendarTab()
      ? '<h1><button type="button" class="period-title" data-action="jump" aria-label="日付を指定、' + escape(periodText()) + '">' +
        periodText() + '<span class="chevron"></span></button></h1>' +
        '<div class="period-controls"><button type="button" data-action="prev" aria-label="前のページ">前</button>' +
        '<button type="button" data-action="today">今日</button><button type="button" data-action="next" aria-label="次のページ">次</button></div>'
      : "<h1>" + labels[state.view] + "</h1>") +
    '</div><div class="toolbar-tools"><button type="button" class="button icon-button search-button" data-action="search" ' +
    'aria-label="予定を検索">' + icon("search") + '</button><button type="button" class="button primary add-button" data-action="' +
    (state.view === "tasks" ? "add-task" : "add") + '">' + icon("plus") +
    "<span>" + (state.view === "tasks" ? "タスクを追加" : "予定を追加") + "</span></button></div></header>";
}

function monthTitle(key) {
  const date = dateOf(key);
  return date.getFullYear() + "年" + (date.getMonth() + 1) + "月";
}

function weekdayHeader(days) {
  return '<div class="weekday-row">' + days.map((key) =>
    '<span class="' + dayClass(key) + '">' + weekdays[dateOf(key).getDay()] + "</span>").join("") + "</div>";
}

function dateButton(key, activeMonth, column, mini = false) {
  const day = dateOf(key).getDate();
  const isDimmed = !key.startsWith(activeMonth);
  const style = mini ? "" : ' style="grid-column:' + (column + 1) + '"';
  return '<button type="button" class="date-cell ' + dayClass(key) + (isDimmed ? " is-other-month" : "") +
    todayClass(key) + selectedClass(key) + '" data-action="select" data-date="' + key + '" aria-label="' +
    fullDate(key) + (key === state.today ? " 今日" : "") + '" aria-pressed="' + (key === state.date) + '"' + style +
    '><span class="date-number">' + day + "</span></button>";
}

function sidebarContent() {
  const key = state.date;
  const weeks = monthWeeks(key, state.data.settings.firstDay);
  const mini = weekdayHeader(weeks[0]) + '<div class="mini-days">' +
    weeks.flat().map((day) => dateButton(day, key.slice(0, 7), 0, true)).join("") + "</div>";
  return '<div class="brand"><span class="brand-mark">' + icon("calendar") + '</span><span>日々の手帖</span></div>' +
    '<nav class="side-nav" aria-label="メニュー">' +
    '<button type="button" data-action="tab" data-tab="calendar" aria-pressed="' + calendarTab() + '">' +
    icon("calendar") + "<span>カレンダー</span></button>" + tabButton("tasks", "タスク") + tabButton("settings", "設定") +
    '</nav><section class="mini-month" aria-label="ミニカレンダー"><h2>' + monthTitle(key) + "</h2>" + mini + "</section>" +
    '<section class="calendars" aria-label="表示するカレンダー"><h2>カレンダー</h2>' + Object.entries(calendars).map(([id, name]) =>
      '<button type="button" class="legend calendar-' + id + '" data-action="filter" data-calendar="' + id +
      '" aria-pressed="' + !state.data.settings.hidden.includes(id) + '"><span class="legend-mark"></span>' +
      "<span>" + name + '</span><span class="legend-check" aria-hidden="true">✓</span></button>').join("") +
    '</section><div class="storage-label">' + icon("pin") + "端末内に保存</div>";
}

function monthCalendar(events) {
  const weeks = monthWeeks(state.date, state.data.settings.firstDay);
  return '<section class="calendar-card month-card" aria-label="月間カレンダー" data-swipe>' + weekdayHeader(weeks[0]) +
    weeks.map((days) => {
      const { entries, overflow } = weekLayout(days, events);
      return '<div class="month-week">' + days.map((key, col) => dateButton(key, state.date.slice(0, 7), col)).join("") +
        entries.map(({ event, row, firstColumn, lastColumn, band }) =>
          '<button type="button" class="month-event calendar-' + event.calendar + (band ? " band" : "") +
          '" style="grid-row:' + (row + 2) + ";grid-column:" + (firstColumn + 1) + "/" + (lastColumn + 2) +
          '" data-action="event" data-id="' + escape(event.id) + '" title="' + escape(event.title) + '">' +
          escape(event.title) + "</button>").join("") +
        overflow.map((count, col) => count
          ? '<button type="button" class="overflow" style="grid-column:' + (col + 1) +
            '" data-action="select" data-date="' + days[col] + '" aria-label="' + fullDate(days[col]) +
            " ほか" + count + '件">+' + count + "</button>"
          : "").join("") + "</div>";
    }).join("") + "</section>";
}

function eventTime(event, day) {
  if (event.allDay) return "終日";
  if (day > event.startDate) return day === event.endDate ? "〜 " + event.endTime : "継続";
  return event.startTime;
}

function eventRow(event, day, showCalendar = false) {
  return '<button type="button" class="entry calendar-' + event.calendar + '" data-action="event" data-id="' +
    escape(event.id) + '"><span class="entry-mark"></span><span class="entry-time">' + eventTime(event, day) +
    '</span><span class="entry-title">' + escape(event.title) + (showCalendar
      ? '<span class="entry-meta">' + calendars[event.calendar] + (event.sample ? " · サンプル" : "") + "</span>" : "") +
    "</span></button>";
}

function empty(text) {
  return '<p class="empty">' + text + "</p>";
}

function upcomingTasks(key) {
  const tasks = dueTasks(key);
  if (!tasks.length) return "";
  return '<div class="due-tasks">' + tasks.map((task) =>
    '<button class="entry due-task" type="button" data-action="task" data-id="' + escape(task.id) + '">' +
    icon("tasks") + '<span class="entry-title">' + escape(task.title) + "</span></button>").join("") + "</div>";
}

function selectedAgenda(events) {
  const items = eventsOn(events, state.date);
  return '<aside class="agenda" aria-label="選択日の予定"><header class="agenda-head"><div><h2>' + labelDate(state.date) +
    "</h2><p>" + weekdays[dateOf(state.date).getDay()] + '曜日</p></div><span class="agenda-count">' + items.length +
    '件</span></header><div class="entries">' + (items.length ? items.map((event) =>
      eventRow(event, state.date, true)).join("") : empty("予定がありません")) + "</div>" + upcomingTasks(state.date) +
    '<button type="button" class="agenda-add" data-action="add">' + icon("plus") + "この日に予定を追加</button></aside>";
}

function weekCalendar(events) {
  const days = weekDays(state.date, state.data.settings.firstDay);
  return '<section class="calendar-card week-card" aria-label="週間カレンダー" data-swipe>' + days.map((key) => {
    const items = eventsOn(events, key);
    return '<div class="week-row' + selectedClass(key) + '"><button type="button" class="week-date ' + dayClass(key) +
      todayClass(key) + '" data-action="select" data-date="' + key + '" aria-label="' + fullDate(key) +
      '" aria-pressed="' + (key === state.date) + '"><span class="date-number">' + dateOf(key).getDate() +
      "</span><span>" + weekdays[dateOf(key).getDay()] + '</span></button><div class="entries">' +
      (items.length ? items.map((event) => eventRow(event, key)).join("") : empty("予定なし")) +
      upcomingTasks(key) + "</div></div>";
  }).join("") + "</section>";
}

function dayCalendar(events) {
  const items = eventsOn(events, state.date);
  const allDay = items.filter((event) => event.allDay);
  const timed = items.filter((event) => !event.allDay);
  return '<section class="calendar-card day-card" aria-label="日間カレンダー" data-swipe>' +
    '<div class="day-section"><h2>終日</h2>' + (allDay.length ? allDay.map((event) => eventRow(event, state.date, true)).join("")
      : empty("終日予定なし")) + '</div><div class="day-section"><h2>時間指定</h2>' +
    (timed.length ? timed.map((event) => eventRow(event, state.date, true)).join("") : empty("時間指定の予定なし")) +
    "</div>" + upcomingTasks(state.date) + "</section>";
}

function calendarScreen() {
  const events = visibleEvents();
  const displays = { month: monthCalendar, week: weekCalendar, day: dayCalendar };
  return '<div class="calendar-toolbar"><div class="view-tabs" aria-label="カレンダー表示">' +
    tabs.slice(0, 3).map(([value, label]) => tabButton(value, label + "表示")).join("") +
    '</div></div><div class="calendar-layout">' + displays[state.view](events) +
    (state.view === "day" ? "" : selectedAgenda(events)) + "</div>";
}

function taskList() {
  const items = [...state.data.tasks].sort((a, b) =>
    Number(a.done) - Number(b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
  return '<section class="calendar-card list-card"><h2>タスクリスト</h2>' +
    (items.length ? items.map((task) =>
      '<div class="task-row"><button type="button" class="task-toggle" data-action="toggle-task" data-id="' + escape(task.id) +
      '" aria-label="' + escape(task.title) + ' 完了" aria-pressed="' + task.done + '">' + (task.done ? "✓" : "") +
      '</button><button type="button" class="task-title" data-action="task" data-id="' + escape(task.id) + '">' +
      '<span class="' + (task.done ? "done" : "") + '">' + escape(task.title) + "</span>" +
      (task.due ? '<span class="entry-meta">' + fullDate(task.due) + "</span>" : "") + "</button></div>").join("")
      : empty("タスクがありません")) + "</section>";
}

function settingsScreen() {
  const settings = state.data.settings;
  return '<section class="calendar-card list-card"><h2>表示</h2><div class="setting"><label for="week-start">週の開始曜日</label>' +
    '<select id="week-start" data-setting="firstDay"><option value="1"' + (settings.firstDay === 1 ? " selected" : "") +
    '>月曜日</option><option value="0"' + (settings.firstDay === 0 ? " selected" : "") + '>日曜日</option></select></div>' +
    '<div class="setting"><label for="large-text">予定の文字を大きくする</label><input type="checkbox" id="large-text" ' +
    'data-setting="largeText"' + (settings.largeText ? " checked" : "") + "></div>" +
    '<h2>表示するカレンダー</h2>' + Object.entries(calendars).map(([id, name]) =>
      '<div class="setting calendar-' + id + '"><label for="filter-' + id + '"><span class="legend-mark"></span>' +
      name + '</label><input type="checkbox" id="filter-' + id + '" data-setting="filter" data-calendar="' + id + '"' +
      (settings.hidden.includes(id) ? "" : " checked") + "></div>").join("") +
    (state.data.events.some((event) => event.sample)
      ? '<h2>サンプル予定</h2><div class="setting"><button type="button" class="button" data-action="clear-samples">サンプル予定を消去</button></div>' : "") +
    '</section><section class="calendar-card list-card install-card"><h2>ホーム画面に追加</h2>' +
    '<p>iPhoneのSafariでこのページを開き、共有メニューで「ホーム画面に追加」を選びます。予定を登録するときは、ホーム画面のアイコンから開いてください。</p></section>';
}

function render() {
  app.classList.toggle("larger", state.data.settings.largeText);
  sidebar.innerHTML = sidebarContent();
  bottom.innerHTML = tabs.map(([value, label]) => tabButton(value, label)).join("");
  main.innerHTML = toolbar() + (calendarTab() ? calendarScreen() : state.view === "tasks" ? taskList() : settingsScreen());
  app.removeAttribute("aria-busy");
}

function chooseDate(key) {
  state.date = key;
  if (!calendarTab()) state.view = state.lastCalendar;
  render();
}

function chooseTab(next) {
  if (next === "calendar") next = state.lastCalendar;
  if (next === state.view && calendarTab()) state.date = state.today;
  state.view = next;
  if (calendarTab()) state.lastCalendar = next;
  render();
}

async function save(mutate, feedback) {
  state.data = await updatePlanner(state.database, mutate);
  updates?.postMessage("changed");
  render();
  if (feedback) announce(feedback);
}

async function refresh() {
  if (!state.database) return;
  const today = dayKey();
  if (state.date === state.today && today !== state.today) state.date = today;
  state.today = today;
  try {
    state.data = await readPlanner(state.database);
    render();
  } catch {
    announce("保存したデータを読み込めませんでした。");
  }
}

function openDialog(title, content) {
  dialog.innerHTML = '<header class="dialog-head"><h2 id="dialog-title">' + title + '</h2>' +
    '<button class="button icon-button" type="button" data-action="close" aria-label="閉じる">' + icon("close") +
    "</button></header>" + content;
  if (!dialog.open) dialog.showModal();
}

const field = (label, input) => '<label class="field"><span>' + label + "</span>" + input + "</label>";
const input = (name, kind, value, extra = "") =>
  '<input name="' + name + '" type="' + kind + '" value="' + escape(value) + '" ' + extra + ">";
const formButtons = (action, label) =>
  '<div class="form-buttons"><button type="button" class="button" data-action="close">キャンセル</button>' +
  '<button class="button primary" type="submit" data-submit="' + action + '">' + label + "</button></div>";
const formError = '<p class="form-error" role="alert" hidden></p>';

function jumpDialog() {
  openDialog("日付を指定", '<form data-form="jump">' + field("移動先", input("date", "date", state.date, "required")) +
    formButtons("jump", "移動") + "</form>");
}

function eventDialog(event, { duplicate = false } = {}) {
  const defaults = { id: "", title: "", startDate: state.date, endDate: state.date, allDay: false, startTime: "09:00",
    endTime: "10:00", calendar: "personal", location: "", notes: "" };
  const entry = event ? { ...event } : defaults;
  if (duplicate) entry.id = "";
  const eventActions = entry.id ? '<div class="edit-actions"><button type="button" class="button" data-action="duplicate" data-id="' +
    escape(entry.id) + '">複製</button><button type="button" class="button danger" data-action="delete-event" data-id="' +
    escape(entry.id) + '">削除</button></div>' : "";
  openDialog(entry.id ? "予定を編集" : duplicate ? "予定を複製" : "予定を追加",
    '<form data-form="event" data-id="' + escape(entry.id) + '">' +
    field("タイトル", input("title", "text", entry.title, "required maxlength=\"120\"")) +
    '<label class="check-field"><input type="checkbox" name="allDay"' + (entry.allDay ? " checked" : "") + ">終日</label>" +
    '<div class="form-pair">' + field("開始日", input("startDate", "date", entry.startDate, "required")) +
    field(entry.allDay ? "最終日" : "終了日", input("endDate", "date", entry.endDate, "required") + "") +
    '</div><div class="form-pair" data-time-fields' + (entry.allDay ? " hidden" : "") + ">" +
    field("開始時刻", input("startTime", "time", entry.startTime)) + field("終了時刻", input("endTime", "time", entry.endTime)) +
    "</div>" + field("カレンダー", '<select name="calendar">' + Object.entries(calendars).map(([id, name]) =>
      '<option value="' + id + '"' + (id === entry.calendar ? " selected" : "") + ">" + name + "</option>").join("") + "</select>") +
    field("場所", input("location", "text", entry.location, 'maxlength="200"')) +
    field("メモ", '<textarea name="notes" rows="2" maxlength="2000">' + escape(entry.notes) + "</textarea>") +
    formError + eventActions + formButtons("event", "保存") + "</form>");
}

function taskDialog(task) {
  openDialog(task ? "タスクを編集" : "タスクを追加", '<form data-form="task" data-id="' + escape(task?.id || "") + '">' +
    field("タイトル", input("title", "text", task?.title || "", 'required maxlength="120"')) +
    field("期限（任意）", input("due", "date", task?.due || "")) +
    (task ? '<div class="edit-actions"><button type="button" class="button danger" data-action="delete-task" data-id="' +
      escape(task.id) + '">削除</button></div>' : "") + formError + formButtons("task", "保存") + "</form>");
}

function searchDialog() {
  openDialog("予定を検索", '<div class="search-form">' + field("タイトル・場所・メモ", input("query", "search", "", "autofocus")) +
    '<div id="search-results" class="entries"></div></div>');
  search("");
}

function search(value) {
  const query = value.trim().normalize("NFKC").toLocaleLowerCase("ja");
  const results = document.querySelector("#search-results");
  if (!query) {
    results.innerHTML = "";
    return;
  }
  const matches = [...state.data.events].sort(eventOrder).filter((event) => [event.title, event.location, event.notes]
    .some((text) => text.normalize("NFKC").toLocaleLowerCase("ja").includes(query)));
  results.innerHTML = matches.length ? matches.map((event) =>
    '<div class="search-result"><span>' + fullDate(event.startDate) + "</span>" +
    eventRow(event, event.startDate, true) + "</div>").join("") : empty("一致する予定がありません");
}

function setFilter(planner, calendar) {
  const hidden = planner.settings.hidden;
  planner.settings.hidden = hidden.includes(calendar) ? hidden.filter((id) => id !== calendar) : [...hidden, calendar];
}

function updateEntry(list, entry, editing) {
  if (!editing) {
    list.push(entry);
    return;
  }
  const index = list.findIndex((record) => record.id === entry.id);
  if (index < 0) throw new Error("この項目は別の画面で削除されました。");
  list[index] = { ...list[index], ...entry };
}

async function onSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  if (form.dataset.form === "jump") {
    dialog.close();
    chooseDate(values.date);
    return;
  }
  const submitter = form.querySelector("[data-submit]");
  if (submitter.disabled) return;
  const errorNote = form.querySelector(".form-error");
  const editing = !!form.dataset.id;
  const record = { id: form.dataset.id || (crypto.randomUUID?.() ?? Date.now() + "-" + Math.random()), title: values.title.trim() };
  submitter.disabled = true;
  errorNote.hidden = true;
  try {
    if (!record.title) throw new Error("タイトルを入力してください。");
    if (form.dataset.form === "event") {
      const entry = { ...record, calendar: values.calendar, startDate: values.startDate, endDate: values.endDate,
        allDay: !!values.allDay, startTime: values.startTime || "09:00", endTime: values.endTime || "10:00",
        location: values.location.trim(), notes: values.notes.trim(), sample: false };
      if (!validEvent(entry) || (!entry.allDay && (!values.startTime || !values.endTime))) {
        throw new Error("開始と終了の日時を確認してください。");
      }
      await save((planner) => updateEntry(planner.events, entry, editing), "予定を保存しました");
      chooseDate(entry.startDate);
    } else {
      const task = { ...record, due: values.due };
      if (!editing) task.done = false;
      await save((planner) => updateEntry(planner.tasks, task, editing), "タスクを保存しました");
    }
    if (dialog.open) dialog.close();
  } catch (error) {
    errorNote.textContent = error.message || "保存できませんでした。";
    errorNote.hidden = false;
  } finally {
    submitter.disabled = false;
  }
}

document.addEventListener("submit", onSubmit);
document.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !state.data) return;
  const { action, tab, date, id, calendar } = button.dataset;
  const entry = state.data.events.find((record) => record.id === id);
  const task = state.data.tasks.find((record) => record.id === id);
  try {
    switch (action) {
      case "tab": chooseTab(tab); break;
      case "today": state.today = dayKey(); chooseDate(state.today); break;
      case "prev": chooseDate(move(state.date, -1, state.view)); break;
      case "next": chooseDate(move(state.date, 1, state.view)); break;
      case "select": chooseDate(date); break;
      case "jump": jumpDialog(); break;
      case "search": searchDialog(); break;
      case "add": eventDialog(); break;
      case "event": if (entry) eventDialog(entry); break;
      case "duplicate": if (entry) eventDialog(entry, { duplicate: true }); break;
      case "add-task": taskDialog(); break;
      case "task": if (task) taskDialog(task); break;
      case "close": dialog.close(); break;
      case "filter": await save((planner) => setFilter(planner, calendar)); break;
      case "toggle-task":
        await save((planner) => {
          const stored = planner.tasks.find((record) => record.id === id);
          if (stored) stored.done = !stored.done;
        });
        break;
      case "delete-event":
      case "delete-task":
        if (confirm(action === "delete-event" ? "この予定を削除しますか？" : "このタスクを削除しますか？")) {
          const list = action === "delete-event" ? "events" : "tasks";
          await save((planner) => { planner[list] = planner[list].filter((record) => record.id !== id); }, "削除しました");
          if (dialog.open) dialog.close();
        }
        break;
      case "clear-samples":
        if (confirm("サンプル予定を消去しますか？")) {
          await save((planner) => { planner.events = planner.events.filter((record) => !record.sample); }, "サンプル予定を消去しました");
        }
        break;
    }
  } catch {
    announce("変更を保存できませんでした。もう一度お試しください。");
    render();
  }
});

dialog.addEventListener("input", (event) => {
  if (event.target.name === "query") search(event.target.value);
  if (event.target.name === "startDate") {
    const endDate = event.target.form.elements.endDate;
    if (endDate.value < event.target.value) endDate.value = event.target.value;
  }
  if (event.target.name === "allDay") {
    const form = event.target.form;
    form.querySelector("[data-time-fields]").hidden = event.target.checked;
    form.elements.endDate.closest("label").firstElementChild.textContent = event.target.checked ? "最終日" : "終了日";
  }
});

document.addEventListener("change", async (event) => {
  const { setting, calendar } = event.target.dataset;
  if (!setting) return;
  try {
    await save((planner) => {
      if (setting === "filter") setFilter(planner, calendar);
      if (setting === "firstDay") planner.settings.firstDay = Number(event.target.value);
      if (setting === "largeText") planner.settings.largeText = event.target.checked;
    });
  } catch {
    announce("設定を保存できませんでした。");
    render();
  }
});

let gestureStart;
let swipeTime = -Infinity;
main.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" || !event.isPrimary || !event.target.closest("[data-swipe]")) return;
  gestureStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
main.addEventListener("pointercancel", () => { gestureStart = null; });
main.addEventListener("pointerup", (event) => {
  if (!gestureStart || gestureStart.id !== event.pointerId) return;
  const dx = event.clientX - gestureStart.x;
  const dy = event.clientY - gestureStart.y;
  gestureStart = null;
  if (Math.abs(dx) < 52 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  swipeTime = performance.now();
  chooseDate(move(state.date, dx < 0 ? 1 : -1, state.view));
});
main.addEventListener("click", (event) => {
  if (performance.now() - swipeTime > 450) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

updates?.addEventListener("message", refresh);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

try {
  state.database = await openStorage();
  state.data = await readPlanner(state.database);
  render();
} catch {
  app.removeAttribute("aria-busy");
  main.innerHTML = '<section class="calendar-card list-card"><h1>手帖を開けませんでした</h1>' +
    '<p>データの保存を許可して、ページを開き直してください。</p><button type="button" class="button" id="retry">再読み込み</button></section>';
  document.querySelector("#retry").addEventListener("click", () => location.reload());
}

if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./service-worker.js").catch((error) => console.error("Offline setup failed", error));
}
