// ===== 1. SETUP =====
const STORAGE_KEY = "timesheet-v1";
const DAILY_GOAL = 480;   // 8 hours, in minutes
let maxShown = 50;       // how many entries to display (change it with the box at the bottom)

// Your projects: "CODE": "label". When you type just the code (e.g. PRJ-24067) and leave the box,
// it fills in automatically as "PRJ-24067 - de-DE". Add one line per project, with a comma at the end.
// Any new project you type in the form is also added to the dropdown automatically.
const PROJECTS = {
  "PRJ-24067": "de-DE",   // sample only, replace with your own
  // "PRJ-24068": "en-US",
};
const DATE_FORMAT = { weekday: "short", month: "short", day: "numeric", year: "numeric" };

// All entries live here, grouped by date: { "2026-10-13": [ {d, p, s, e}, ... ] }
// d = description, p = project, s = start time, e = end time
let data = {};
const expanded = new Set();   // combined rows that are currently opened (not saved, resets on refresh)
try {
  data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
} catch {
  data = {};
}

const $ = (id) => document.getElementById(id);   // shortcut for finding an element
const save = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
};

// ===== 2. SMALL HELPER FUNCTIONS =====
// Date -> "2026-10-13"
const toIsoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// "2026-10-13" -> "Tue, Oct 13, 2026"
const prettyDate = (iso) => new Date(`${iso}T00:00`).toLocaleDateString(undefined, DATE_FORMAT);

// Minutes between two times like "15:00" and "15:15" (an end before the start counts as next day)
const minutesBetween = (start, end) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff < 0 ? diff + 1440 : diff;
};

// 75 -> "1:15"
const formatDuration = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

// Makes text safe to put inside HTML
const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const isValidTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);   // 00:00 to 23:59
// "prj-24067" -> "PRJ-24067 - de-DE" (if the code is in PROJECTS); anything else is left as typed
function fullProjectName(text) {
  const typed = text.trim();
  const code = Object.keys(PROJECTS).find((c) => c.toLowerCase() === typed.toLowerCase());
  if (!code) return typed;
  return PROJECTS[code] ? `${code} - ${PROJECTS[code]}` : code;
}
const selectedDate = () => $("edate").value;
const dayTotal = (date) => data[date].reduce((sum, x) => sum + minutesBetween(x.s, x.e), 0);

// ===== 3. DRAWING THE LIST =====
function renderGroupHeader(date) {
  const total = dayTotal(date);
  const reached = total >= DAILY_GOAL;
  const status = reached
    ? `<span style="color:var(--ok)">${formatDuration(total)}${total > DAILY_GOAL ? ` (+${formatDuration(total - DAILY_GOAL)})` : " ✓"}</span>`
    : `${formatDuration(total)} <span class="mut">/ 8:00 · ${formatDuration(DAILY_GOAL - total)} left</span>`;
  const width = Math.min(100, (total / DAILY_GOAL) * 100);
  return `<div class="gh">
    <div class="t"><span>${prettyDate(date)}</span><span>${status}</span></div>
    <div class="bar"><i class="${reached ? "done" : ""}" style="width:${width}%"></i></div>
  </div>`;
}

// Every entry is always editable: just click a box and change it. Changes save automatically.
// One row for several entries with the same description and project on the same day
function renderCombined(group, key, open) {
  const total = group.reduce((sum, m) => sum + minutesBetween(m.entry.s, m.entry.e), 0);
  const { d, p } = group[0].entry;
  return `<div class="row item group" data-key="${encodeURIComponent(key)}">
    <div>${open ? "▾" : "▸"} ${escapeHtml(d)} <span class="badge">(${group.length})</span></div>
    <div class="mut">${escapeHtml(p)}</div>
    <div class="mut">${open ? "click to combine" : "click to expand"}</div>
    <div class="dur">${formatDuration(total)}</div>
    <div></div>
  </div>`;
}

function renderEntry({ date, index, entry }, sub = false) {
  const at = `data-date="${date}" data-index="${index}"`;   // tells us which entry a box belongs to
  return `<div class="row item${sub ? " sub" : ""}">
    <input ${at} data-field="d" value="${escapeHtml(entry.d)}" placeholder="(no description)">
    <input ${at} data-field="p" list="projs" value="${escapeHtml(entry.p)}" placeholder="Project">
    <div class="times">
      <input ${at} data-field="s" data-time inputmode="numeric" maxlength="5" autocomplete="off" value="${entry.s}">
      <span>–</span>
      <input ${at} data-field="e" data-time inputmode="numeric" maxlength="5" autocomplete="off" value="${entry.e}">
    </div>
    <div class="dur">${formatDuration(minutesBetween(entry.s, entry.e))}</div>
    <div class="acts">
      <span class="cal">
        <button type="button" data-act="date" style="padding:4px 8px;font-size:15px" title="Change date">📅</button>
        <input type="date" class="rdate" ${at} data-field="date" value="${date}" tabindex="-1">
      </span>
      <button data-act="duplicate" ${at} title="Duplicate">⧉</button>
      <button class="x" data-act="delete" ${at} title="Delete">✕</button>
    </div>
  </div>`;
}

function render() {
  // Remember which box the cursor is in, so we can put it back after redrawing
  const active = document.activeElement;
  const focused = active?.dataset?.field ? { ...active.dataset } : null;

  // Flatten everything into one list, newest date first, earliest start first within a day
  const all = Object.entries(data).flatMap(([date, entries]) =>
    entries.map((entry, index) => ({ date, index, entry }))
  );
  all.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.entry.s < b.entry.s ? -1 : 1
  );

  // Show a date header whenever the date changes
  // Entries on the same day with the same description and project are shown as one combined row
  const keyOf = (item) => `${item.date}|${item.entry.d.toLowerCase()}|${item.entry.p.toLowerCase()}`;
  const shown = all.slice(0, maxShown);
  const members = {};
  for (const item of shown) {
    if (item.entry.d) (members[keyOf(item)] ??= []).push(item);
  }

  let html = "";
  let lastDate = "";
  const drawn = new Set();   // combined rows already drawn
  for (const item of shown) {
    if (item.date !== lastDate) {
      lastDate = item.date;
      html += renderGroupHeader(item.date);
    }
    const key = keyOf(item);
    const group = item.entry.d ? members[key] : null;
    if (group && group.length > 1) {
      if (drawn.has(key)) continue;   // its other entries are drawn together with the first one
      drawn.add(key);
      const open = expanded.has(key);
      html += renderCombined(group, key, open);
      if (open) html += group.map((m) => renderEntry(m, true)).join("");
    } else {
      html += renderEntry(item);
    }
  }

  $("list").innerHTML = html || '<div class="mut">No entries yet.</div>';
  $("more").textContent = all.length > maxShown ? `Showing latest ${maxShown} of ${all.length} entries.` : "";

  // Dropdown options: the PROJECTS list plus projects you already used
  const listed = Object.entries(PROJECTS).map(([code, label]) => (label ? `${code} - ${label}` : code));
  const used = all.map((item) => item.entry.p).filter(Boolean);
  const projects = [...new Set([...listed, ...used])];   // your list first, then ones you've typed
  $("projs").innerHTML = projects.map((p) => `<option value="${escapeHtml(p)}">`).join("");

  if (focused) {
    $("list").querySelector(
      `[data-date="${focused.date}"][data-index="${focused.index}"][data-field="${focused.field}"]`
    )?.focus();
  }
}

// ===== 4. TIME INPUTS (24-hour typing) =====
// While typing: "1500" becomes "15:00". When leaving the box (final = true): "9" becomes "09:00".
function fixTime(input, final) {
  const digits = input.value.replace(/\D/g, "").slice(0, 4);
  let v = digits;
  if (final) {
    if (digits.length <= 2 && digits.length > 0) v = digits.padStart(2, "0") + "00";
    else if (digits.length === 3) v = "0" + digits;
  }
  if (v.length > 2) v = `${v.slice(0, 2)}:${v.slice(2)}`;
  if (final && v && !isValidTime(v)) v = "";   // throw away impossible times like 25:99
  input.value = v;
}

function updatePreviewDuration() {
  const start = $("st").value;
  const end = $("en").value;
  $("pdur").textContent = isValidTime(start) && isValidTime(end) ? formatDuration(minutesBetween(start, end)) : "0:00";
}

for (const id of ["st", "en"]) {
  const input = $(id);
  input.addEventListener("input", () => { fixTime(input, false); updatePreviewDuration(); });
  input.addEventListener("blur", () => { fixTime(input, true); updatePreviewDuration(); });
}

// ===== 5. BUTTONS =====
// Typing a project code and leaving the box fills in its label
$("proj").addEventListener("blur", () => { $("proj").value = fullProjectName($("proj").value); });

// Add an entry
$("add").addEventListener("click", () => {
  fixTime($("st"), true);
  fixTime($("en"), true);
  const start = $("st").value;
  const end = $("en").value;
  const date = selectedDate();

  if (!date) return alert("Pick a date");
  if (!isValidTime(start) || !isValidTime(end)) {
    return alert("Enter start and end time in 24-hour format, e.g. 15:00");
  }

  data[date] ??= [];   // create the day's list if it doesn't exist yet
  data[date].push({ d: $("desc").value.trim(), p: fullProjectName($("proj").value), s: start, e: end });
  data[date].sort((a, b) => (a.s < b.s ? -1 : 1));
  save();

  $("desc").value = "";
  $("st").value = end;   // next entry starts where this one ended
  $("en").value = "";
  updatePreviewDuration();
  render();
  $("desc").focus();
});

// Open/close a combined row, delete or duplicate an entry, or open its date picker (one listener for the whole list)
$("list").addEventListener("click", (event) => {
  const groupRow = event.target.closest(".row.group");
  if (groupRow) {
    const key = decodeURIComponent(groupRow.dataset.key);
    if (expanded.has(key)) expanded.delete(key);
    else expanded.add(key);
    render();
    return;
  }

  const button = event.target.closest("button[data-act]");
  if (!button) return;

  if (button.dataset.act === "date") {
    const picker = button.nextElementSibling;
    try { picker.showPicker(); } catch { picker.focus(); picker.click(); }
    return;
  }

  const { date, index } = button.closest(".row").querySelector("input").dataset;
  if (button.dataset.act === "duplicate") {
    data[date].splice(Number(index) + 1, 0, { ...data[date][Number(index)] });   // the copy goes right after the original
  } else {
    data[date].splice(Number(index), 1);
    if (data[date].length === 0) delete data[date];
  }
  save();
  render();
});

// Saving happens automatically when you finish changing a box (click away, Tab or Enter)
$("list").addEventListener("change", (event) => {
  const box = event.target;
  const { date, index, field } = box.dataset;
  if (!field) return;
  const entry = data[date][Number(index)];

  if (field === "d") {
    entry.d = box.value.trim();
  } else if (field === "p") {
    entry.p = fullProjectName(box.value);
  } else if (field === "s" || field === "e") {
    fixTime(box, true);
    if (!isValidTime(box.value)) alert("Enter the time in 24-hour format, e.g. 15:00");
    else entry[field] = box.value;
  } else if (field === "date") {
    if (box.value) {
      data[date].splice(Number(index), 1);              // move the entry to the new date
      if (data[date].length === 0) delete data[date];
      (data[box.value] ??= []).push(entry);
    }
  }

  save();
  // Redraw a moment later, so a Tab to the next box isn't interrupted
  setTimeout(render, 0);
});

// While typing a time: "1500" becomes "15:00"
$("list").addEventListener("input", (event) => {
  if (event.target.matches("[data-time]")) fixTime(event.target, false);
});

// The "Show 50 / 100 / 150 entries" box at the bottom
$("limit").addEventListener("change", () => {
  maxShown = Number($("limit").value);
  render();
});

// Calendar icon: open the date picker, and show the chosen date as a tooltip
function updateDateTooltip() {
  const date = selectedDate();
  $("calbtn").title = date ? `Date: ${prettyDate(date)}` : "Pick a date";
}
$("calbtn").addEventListener("click", () => {
  const picker = $("edate");
  try { picker.showPicker(); } catch { picker.focus(); picker.click(); }
});
$("edate").addEventListener("change", updateDateTooltip);

// ===== 6. CSV EXPORT =====
// Wrap a value in quotes if it contains commas, quotes or line breaks
const csvCell = (v) => {
  const text = String(v ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

function buildCsv() {
  const rows = [["Date", "Description", "Project", "Start", "End", "Duration"]];
  for (const date of Object.keys(data).sort()) {
    const entries = [...data[date]].sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : 0));
    for (const x of entries) {
      rows.push([date, x.d, x.p, x.s, x.e, formatDuration(minutesBetween(x.s, x.e))]);
    }
  }
  // The leading \ufeff helps Excel read special characters correctly
  return "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

// Plain browser download (works when you open the file yourself or host it on GitHub Pages)
function downloadFile(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("exp").addEventListener("click", async () => {
  if (Object.keys(data).length === 0) return alert("No entries to export yet.");
  const filename = `timesheet-${toIsoDate(new Date())}.csv`;
  const csv = buildCsv();

  // Inside claude.ai, downloads go through its own save feature; anywhere else, use a normal download
  let downloads = null;
  try { downloads = await window.claude?.use("downloads"); } catch {}

  if (downloads) {
    try { await downloads.save({ filename, data: csv }); } catch {}
  } else {
    downloadFile(filename, csv);
  }
});

// ===== 7. START =====
$("edate").value = toIsoDate(new Date());   // default to today
updateDateTooltip();
render();