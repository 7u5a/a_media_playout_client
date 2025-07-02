const net = require("net");

let client;
let isConnected = false;
let commandQueue = [];
let responseHandler = null;
let responseBuffer = "";

function connect() {
  client = new net.Socket();

  client.connect(5250, "127.0.0.1", () => {
    isConnected = true;
    console.log("✅ Forbundet til CasparCG");
    // Tøm eventuelle ventende kommandoer
    commandQueue.forEach((fn) => fn());
    commandQueue = [];
  });

  client.on("data", (data) => {
    const text = data.toString();
    responseBuffer += text;

    // Split op i komplette linjer
    const lines = responseBuffer.split("\r\n");
    responseBuffer = lines.pop(); // evt. ufuldstændig linje gemmes

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      console.log("📥 CasparCG:", trimmedLine);

      // Brug kun responseHandler hvis den er sat
      if (typeof responseHandler === "function") {
        // Vi sender ALLE linjer til handler – den beslutter selv hvad den vil bruge
        responseHandler(trimmedLine);
      }
    }
  });

  client.on("error", (err) => {
    console.error("❌ Forbindelsesfejl:", err.message);
    isConnected = false;
  });

  client.on("close", () => {
    console.warn("🔌 Forbindelse lukket, forsøger igen om 3 sek...");
    isConnected = false;
    setTimeout(connect, 3000);
  });
}

connect();

// Hjælpefunktion til at sende en kommando
function sendCommand(command, expectXml = false) {
  return new Promise((resolve, reject) => {
    if (!isConnected) return reject("🚫 Ikke forbundet til CasparCG");

    console.log("➡️ Sender:", command);
    client.write(command + "\r\n");

    let buffer = "";
    let isXmlStarted = false;

    responseHandler = (line) => {
      // Hvis vi forventer XML, og det starter med <?xml ...>
      if (expectXml) {
        if (line.startsWith("<?xml")) {
          isXmlStarted = true;
          buffer = line + "\r\n";
        } else if (isXmlStarted) {
          buffer += line + "\r\n";
        }

        // Når vi når </channel> er XML'en komplet
        if (line.includes("</channel>")) {
          resolve(buffer);
          responseHandler = null;
        }
      } else {
        // Hvis vi ikke forventer XML: forvent statuskoder
        if (line.startsWith("202") || line.startsWith("200")) {
          resolve(line);
          responseHandler = null;
        } else {
          reject("❌ Uventet svar: " + line);
          responseHandler = null;
        }
      }
    };
  });
}


// Funktion til at hente aktuelt klip
async function getCurrentClip() {
  try {
    const response = await sendCommand("INFO 1-10", true);
    console.log("🧾 Rå CasparCG-svar:", response);

    const nameMatch = response.match(/<name>\s*([^<]+)\s*<\/name>/i);
    const clipName = nameMatch ? nameMatch [1] : "Intet";

    const durationMatch = [...response.matchAll(/<clip>([\d.]+)<\/clip>/gi)];
    let duration = null;
    if (durationMatch.length === 2) {
      const start = parseFloat(durationMatch[0][1]);
      const end = parseFloat(durationMatch[1][1]);
      duration = end - start;
    }

    const timeMatch = response.match(/<time>\s*([\d.]+)\s*<\/time>/i);
    const currentTime = timeMatch ? parseFloat(timeMatch[1]) : null;

    console.log("🎯 Fundet filnavn:", clipName, "⏱ Varighed:", duration);

    return { clip: clipName, time: currentTime, duration };
  } catch (err) {
    console.error("❌ Fejl i getCurrentClip:", err);
    throw err;
  }
}

// Funktioner til eksport
function playClip(filename) {
  return sendCommand(`PLAY 1-10 "${filename}"`);
}

function controlClip(action) {
  const commands = {
    stop: "STOP 1-10",
    pause: "PAUSE 1-10",
    resume: "RESUME 1-10"
  };

  if (!commands[action]) {
    return Promise.reject("Ugyldig handling: " + action);
  }

  return sendCommand(commands[action]);
}

function getConnectionStatus() {
  return isConnected;
}

module.exports = { playClip, controlClip, getCurrentClip, getConnectionStatus };
