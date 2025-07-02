const express = require("express");
const http = require("http");
const WebSocket = require("ws"); // <-- DENNE LINJE ER VIGTIG!
const path = require("path");
const startOSC = require("./services/osc-listener");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Gør wss tilgængelig i andre filer via global
global.wss = wss;

app.use(express.static(path.join(__dirname, "public")));

const controlRoutes = require("./routes/control");
app.use("/api", controlRoutes);

startOSC(); // Starter OSC-listener og sender data til WebSocket-klienter

const PORT = 5555;
server.listen(PORT, () => {
  console.log(`Server kører på http://localhost:${PORT}`);
});

// Fallback til frontend app ved alle andre GET requests
app.use((req, res) => {
  if (req.method === "GET") {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  } else {
    next();
  }
});