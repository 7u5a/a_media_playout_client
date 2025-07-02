const ws = new WebSocket(`ws://${window.location.host}`);

ws.onopen = () => {
  console.log("✅ WebSocket forbindelse åbnet");
};

ws.onerror = (err) => {
  console.error("❌ WebSocket fejl:", err);
};

ws.onclose = () => {
  console.warn("⚠️ WebSocket forbindelse lukket");
};

let clipDuration = 0;
let currentTime = 0;
let playing = false;
let timelineInterval = null;

ws.onmessage = function (event) {
  const msg = JSON.parse(event.data);
  //console.log("📥 OSC modtaget:", msg);
  const statusEl = document.getElementById("status");

  // ⏱ OSC: Tid og varighed
  if (msg.address.endsWith("/file/time") && msg.args.length === 2) {
    const [position, duration] = msg.args;

    if (duration > 0) {
      currentTime = position;
      clipDuration = duration;
      updateTimeline();

      if (!playing) {
        playing = true;
      }
    }
  }

  // 🎬 OSC: Klipnavn
  if (msg.address.endsWith("/file/path")) {
    const filePath = msg.args[0];
    document.getElementById("currentClip").innerText = filePath.split("/").pop();
    statusEl.innerText = `▶️ Afspiller: ${filePath}`;
  }
};

// ▶️ Afspil klip
function playClip() {
  const filename = document.getElementById("filename").value;

  fetch(`/api/play?file=${encodeURIComponent(filename)}`)
    .then(res => res.text())
    .then(msg => {
      document.getElementById("status").innerText = msg;
    });
}

// ⏯ Pause / Resume / Stop
function controlClip(action) {
  if (!["stop", "pause", "resume"].includes(action)) return;

  fetch(`/api/${action}`)
    .then(res => res.text())
    .then(msg => {
      document.getElementById("status").innerText = msg;

      if (action === "stop") {
        clipDuration = 0;
        currentTime = 0;
        updateTimeline();
        stopTimeline();
        playing = false;
        document.getElementById("currentClip").innerText = "intet";
      } else if (action === "pause") {
        playing = false;
        stopTimeline();
      } else if (action === "resume") {
        playing = true;
        startTimeline();
      }
    })
    .catch(err => {
      document.getElementById("status").innerText = `Fejl: ${err}`;
    });
}

// 🔄 Vis forbindelsesstatus til server
async function updateStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const btn = document.getElementById('statusButton');

    if (data.status === "Forbundet") {
      btn.classList.remove("disconnected");
      btn.classList.add("connected");
      btn.textContent = "Connected";
    } else {
      btn.classList.remove("connected");
      btn.classList.add("disconnected");
      btn.textContent = "Disconnected";
    }
  } catch {
    const btn = document.getElementById('statusButton');
    btn.classList.remove("connected");
    btn.classList.add("disconnected");
    btn.textContent = "Disconnected";
  }
}

updateStatus();
setInterval(updateStatus, 5000);

// ⏱ Tidsformat
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// 🟦 Tidslinje (progress bar)
function updateTimeline() {
  const percent = clipDuration > 0 ? (currentTime / clipDuration) * 100 : 0;
  document.getElementById("timelineProgress").style.width = `${Math.min(percent, 100)}%`;
  document.getElementById("duration").innerText = `${formatTime(currentTime)} / ${formatTime(clipDuration)}`;
}

// ⏹ Stop tidslinje-opdatering (hvis der bruges en animation)
function stopTimeline() {
  if (timelineInterval) {
    clearInterval(timelineInterval);
    timelineInterval = null;
  }
}
