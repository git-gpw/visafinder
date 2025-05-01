// === Load target URL from storage ======================================
let TARGET = "";

chrome.storage.local.get("CONFIG_TARGET").then(({ CONFIG_TARGET }) => {
  TARGET = CONFIG_TARGET || "https://prenotami.esteri.it/";

  document.getElementById("target").textContent =
    TARGET.replace(/^https?:\/\//, "");

  refresh();        // now safe to call
});
// =======================================================================

// ---------- existing code below this line ------------------------------
async function refresh() {
    const { log = [], auto_log = [] } =
        await chrome.storage.local.get(["log", "auto_log"]);
  // counters
  document.getElementById("count").textContent = log.length;
  document.getElementById("auto").textContent  = auto_log.length;

  // --- manual: show days-ago ------------------------------------------
  const lastManualTs = log.at(-1);
  let daysText = "–";
  if (lastManualTs) {
    const msPerDay   = 86_400_000;                     // 24h in ms
    const diffDays   = Math.floor((Date.now() - lastManualTs) / msPerDay);
    daysText = diffDays === 0 ? "oggi"                 // today
              : diffDays === 1 ? "ieri"                // yesterday
              : diffDays + " giorni fa";               // X days ago (Italian)
  }
  document.getElementById("lastManual").textContent = daysText;
  // --------------------------------------------------------------------

  // auto: still show absolute timestamp (keep previous code)
  const fmt = ts => ts ? new Date(ts).toLocaleString() : "–";
  document.getElementById("lastAuto").textContent   = fmt(auto_log.at(-1));
}

document.getElementById("exportBtn").addEventListener("click", async () => {
  const { log = [] } = await chrome.storage.local.get("log");
  if (!log.length) return alert("No visits yet!");

  const header = "timestamp_iso\n";
  const csv = header + log.map(ts => new Date(ts).toISOString()).join("\n");

  const blobUrl = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );

  await chrome.downloads.download({
    url: blobUrl,
    filename: "visit_log.csv",
    saveAs: true
  });

  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
});

// animation listener (if you added it earlier)
chrome.runtime.onMessage.addListener(({ type }) => {
  if (type === "new_visit") {
    refresh().then(animateCount);
  } else if (type === "auto_visit") {
    refresh().then(animateCount);
  }
});

function animateCount() {
  const el = document.getElementById("count");
  el.classList.remove("animate");
  void el.offsetWidth;           // reset animation
  el.classList.add("animate");
}
