const express = require("express");
const router = express.Router();
const { playClip, controlClip, getCurrentClip, getConnectionStatus } = require("../services/amcp-client");

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
