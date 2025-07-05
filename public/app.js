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
let currentFile = "";
let isPaused = false;

ws.onmessage = function (event) {
  const msg = JSON.parse(event.data);

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
    currentFile = filePath.split("/").pop();
    document.getElementById("currentClip").innerText = currentFile;
    updateStatusText();
  }

  if (msg.address.endsWith("/paused")) {
    isPaused = msg.args[0] === true;
    updateStatusText();
  }
};

// 📝 Opdater status tekst
function updateStatusText() {
  const statusEl = document.getElementById("status");
  if (currentFile === "") {
    statusEl.innerText = "⏹ Ingen klip";
  } else if (isPaused) {
    statusEl.innerText = `⏸ Pauset: ${currentFile}`;
  } else {
    statusEl.innerText = `▶️ Afspiller: ${currentFile}`;
  }
}

// ▶️ Afspil valgt klip
function playClip() {
  const filename = document.getElementById("filename").value.trim();
  if (!filename) {
    alert("Vælg venligst et klip først!");
    return;
  }

  fetch(`/api/play?file=${encodeURIComponent(filename)}`)
    .then(res => res.text())
    .then(msg => {
      document.getElementById("status").innerText = `▶️ Afspiller: ${filename}`;
      document.getElementById("currentClip").innerText = filename;
      playing = true;
      //startTimeline();  // Hvis du har en funktion til at starte tidslinje-opdatering
    })
    .catch(err => {
      document.getElementById("status").innerText = `Fejl: ${err}`;
      console.error(err);
    });
}

// ⏯ Pause / Resume / Stop
function controlClip(action) {
  if (!["stop", "pause", "resume"].includes(action)) return;

  fetch(`/api/${action}`)
    .then(res => res.text())
    .then(msg => {
      if (action === "stop") {
        setTimeout(() => {
          clipDuration = 0;
          currentTime = 0;
          updateTimeline();
          stopTimeline();
          playing = false;
          currentFile = "";
          document.getElementById("currentClip").innerText = "intet";
          document.getElementById("status").innerText = "⏹ Ingen klip";
        }, 200);
      } else {
        document.getElementById("status").innerText = msg;
        if (action === "pause") {
          playing = false;
          stopTimeline();
        } else if (action === "resume") {
          playing = true;
          startTimeline();
        }
      }
    })
    .catch(err => {
      document.getElementById("status").innerText = `Fejl: ${err}`;
    });
}

// 🔄 Statusindikator
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

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateTimeline() {
  const percent = clipDuration > 0 ? (currentTime / clipDuration) * 100 : 0;
  document.getElementById("timelineProgress").style.width = `${Math.min(percent, 100)}%`;
  document.getElementById("duration").innerText = `${formatTime(currentTime)} / ${formatTime(clipDuration)}`;
}

function stopTimeline() {
  if (timelineInterval) {
    clearInterval(timelineInterval);
    timelineInterval = null;
  }
}

// Hent medieliste og lav klikbar liste
function fetchMediaList() {
  fetch("/api/media")
    .then(res => res.json())
    .then(data => {
      const medialistDiv = document.getElementById("medialist");
      medialistDiv.innerHTML = ""; // Ryd gammel liste

      if (!data.files || data.files.length === 0) {
        medialistDiv.innerText = "Ingen mediefiler fundet.";
        return;
      }

      const list = document.createElement("ul");
      data.files.forEach(file => {
        const item = document.createElement("li");
        item.textContent = file;
        item.style.cursor = "pointer";
        item.onclick = () => {
          document.getElementById("filename").value = file;
          document.getElementById("currentClip").innerText = `Valgt klip: ${file}`;
          document.getElementById("status").innerText = "⏹ Klar";
          playing = false; // Stopper automatisk play
        };
        list.appendChild(item);
      });

      medialistDiv.appendChild(list);
    })
    .catch(err => {
      document.getElementById("medialist").innerText = "Fejl ved hentning af mediafiler.";
      console.error(err);
    });
}

// Kør ved opstart
fetchMediaList();
