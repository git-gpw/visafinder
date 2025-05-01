// service-worker context
importScripts('luxon.min.js');      // now "luxon" global is available
const { DateTime } = luxon;
// === CONFIG ======================================================
const DEFAULT_TARGET = "https://prenotami.esteri.it/";          // exact or startsWith match
const MIN_INTERVAL = 5 * 60 * 1000;             // 5 minutes, in ms
const DEFAULT_TIMEZONE = "Europe/Rome";
const DEFAULT_SCHEDULE = [
        { day: 0, time: "23:58" }, //Sunday 23:58 Rome - 2 min before midnight
        { day: 2, time: "23:58" } //Tuesday 23:58 Rome - 2 min before midnight
      ];
// =================================================================
/* --- runtime copy of the target URL ----------------------------- */
let TARGET = DEFAULT_TARGET;                // fallback

chrome.storage.local.get("CONFIG_TARGET").then(({ CONFIG_TARGET }) => {
  if (CONFIG_TARGET) TARGET = CONFIG_TARGET;

  /* now that TARGET is set, attach the listener */
  chrome.history.onVisited.addListener(({ url }) => {
    if (url.startsWith(TARGET)) recordVisit(Date.now());
  });
});
/* --------------------------------------------------------------- */

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    CONFIG_TARGET:   DEFAULT_TARGET,
    CONFIG_TIMEZONE: DEFAULT_TIMEZONE,
    CONFIG_SCHEDULE: DEFAULT_SCHEDULE
  });
});

async function recordVisit(now) {
  const { log = [] } = await chrome.storage.local.get("log");
  if (!log.length || now - log.at(-1) >= MIN_INTERVAL) {
    log.push(now);
    await chrome.storage.local.set({ log });
    // 🔔 notify any open popup
    chrome.runtime
      .sendMessage({ type: "new_visit", ts: now })
      .catch(() => {});          // ignore “no popup open”
  }
}

// time - zone aware schedeuler
function nextRunTZ(schedule, tz) {
  const nowTz = DateTime.now().setZone(tz);  // current time IN target zone
  let soonest = null;

  for (const { day, time } of schedule) {
    const [h, m] = time.split(":").map(Number);
    // Luxon weekday: 1-Mon … 7-Sun  — convert JS day (0-Sun … 6-Sat)
    let candidate = nowTz.set({
      weekday: ((day + 1) % 7) || 7,
      hour: h,
      minute: m,
      second: 0,
      millisecond: 0
    });
    if (candidate <= nowTz) candidate = candidate.plus({ weeks: 1 });
    if (!soonest || candidate < soonest) soonest = candidate;
  }
  return soonest ? soonest.toMillis() : null;  // epoch ms UTC
}
//helper function for auto opener counter
async function recordAuto(now) {
  const { auto_log = [] } = await chrome.storage.local.get("auto_log");
  auto_log.push(now);
  await chrome.storage.local.set({ auto_log });
  chrome.runtime.sendMessage({ type: "auto_visit", ts: now }).catch(() => {});
}
//
async function planNext() {
  const { CONFIG_SCHEDULE = [], CONFIG_TIMEZONE = "UTC" } =
        await chrome.storage.local.get(["CONFIG_SCHEDULE", "CONFIG_TIMEZONE"]);

  const when = nextRunTZ(CONFIG_SCHEDULE, CONFIG_TIMEZONE);
  if (when) chrome.alarms.create("autoOpen", { when });
}

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name !== "autoOpen") return;

  const { CONFIG_TARGET } = await chrome.storage.local.get("CONFIG_TARGET");
  if (CONFIG_TARGET) chrome.tabs.create({ url: CONFIG_TARGET });

  // schedule the following run
  recordAuto(Date.now());
  planNext();
});

// schedule on startup
planNext();
