const express = require("express");
const router = express.Router();
const { playClip, controlClip, getCurrentClip, getConnectionStatus } = require("../services/amcp-client");
const net = require("net");

router.get("/play", async (req, res) => {
  const file = req.query.file || "example.mp4";

  try {
    const response = await playClip(file);
    res.send(response); // fx "Afspiller klippet"
  } catch (error) {
    res.status(500).send(error); // fx "CasparCG fejl: ..."
  }
});

router.get("/status", (req, res) => {
  const status = getConnectionStatus() ? "Forbundet" : "Ikke forbundet";
  res.json({ status });
});

router.get("/current", async (req, res) => {
  try {
    const result = await getCurrentClip();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Kunne ikke hente aktuelt klip" });
  }
});


function getMediaFiles() {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let dataBuffer = "";

    client.connect(5250, "127.0.0.1", () => {
      client.write("CLS\r\n");
    });

    client.on("data", (data) => {
      dataBuffer += data.toString();
      if (dataBuffer.includes("\r\n")) {
        client.end();
      }
    });

    client.on("end", () => {
      const lines = dataBuffer.split("\r\n");

      // Filtrér kun linjer hvor anden kolonne er MOVIE
      const mediaLines = lines.filter(line => {
        if (!line) return false;
        // Linjer har format: "NAVN"  TYPE  STØRRELSE  DATO  ... (del med mellemrum)
        const parts = line.match(/"([^"]+)"\s+(\S+)/);
        if (!parts) return false;

        const type = parts[2];
        return type === "MOVIE";
      });

      // Hent filnavn (uden anførselstegn)
      const files = mediaLines.map(line => {
        const match = line.match(/"([^"]+)"/);
        return match ? match[1] : null;
      }).filter(f => f !== null);

      resolve(files);
    });

    client.on("error", reject);
  });
}

router.get("/media", async (req, res) => {
  try {
    const mediaFiles = await getMediaFiles();
    console.log("Media files:", mediaFiles);
    res.json({ files: mediaFiles });
  } catch (err) {
    console.error("Fejl ved hentning af mediafiler:", err);
    res.status(500).json({ error: "Kunne ikke hente mediafiler" });
  }
});


router.get("/:action", async (req, res) => {
  const action = req.params.action;

  if (!["stop", "pause", "resume"].includes(action)) {
    return res.status(400).send("Ugyldig handling");
  }

  try {
    const response = await controlClip(action);
    res.send(response);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

module.exports = router;
