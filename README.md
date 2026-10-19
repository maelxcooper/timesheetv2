# Timesheet

A simple daily timesheet that runs in the browser. Log what you worked on, the project, and the start and end time, and it calculates the duration and tracks your progress toward 8 hours a day. No install, no account, no server.

**Live page:** https://maelxcooper.github.io/timesheet/

## Features

- **24-hour time entry.** Type `1500` and it becomes `15:00`. No AM/PM.
- **Automatic duration.** `15:00 – 15:15` shows `0:15` next to it.
- **Daily totals and 8-hour goal.** Each date shows its total, the time left, and a progress bar that turns green when you reach 8:00.
- **Date per entry.** Use the 📅 button to log an entry on any date. Entries are stacked by date, newest first.
- **Project dropdown with auto-fill.** Type just a project code (like `PRJ-24067`) and it fills in the full label (like `PRJ-24067 - de-DE`).
- **Edit in place.** Click any description, project, or time on a saved entry and change it. It saves automatically.
- **Duplicate and delete.** Use ⧉ to copy an entry and ✕ to remove one.
- **Combined rows.** Entries on the same day with the same description and project show as one row with a count, like `Code review (2)`, and the combined time. Click the row to expand it, and click again to combine it.
- **Show 50, 100, or 150 entries.** The list shows the latest 50 by default.
- **Export to CSV.** Download all your entries as a file for backup or for copying into another system.

## How to use

1. Type what you worked on, pick or type a project, and enter the start and end time.
2. Pick the date with the 📅 icon if it isn't today.
3. Click **+** to add the entry.

## Adding your projects

Open `script.js` and edit the `PROJECTS` list near the top. Each line is `"CODE": "label",`:

```js
const PROJECTS = {
  "PRJ-24067": "de-DE",
  "PRJ-24068": "en-US",
};
```

Any new project you type in the form is also added to the dropdown automatically.

## Where your data is saved

Entries are saved in your **browser's local storage**, on your own device only. That means:

- They stay when you close the tab or restart your computer.
- They are **not** shared with anyone, and you can't see them from another browser or device.
- They are deleted if you clear your browsing data, use a private window, or your browser is set to clear site data on exit.

**Export a CSV regularly as a backup.**

## Run it locally

Download or clone the repository and open `index.html` in your browser. No build step is needed.

## Host it on GitHub Pages

1. Make sure `index.html` is at the top level of the repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**, and click **Save**.
4. Your page will be live at `https://<your-username>.github.io/<repository-name>/` after a minute or two.

## Built with

Plain HTML, CSS, and JavaScript.
