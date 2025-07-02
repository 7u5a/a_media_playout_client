const osc = require("osc");

function startOSC() {
    const udpPort = new osc.UDPPort({
        localAddress: "127.0.0.1",
        localPort: 6250,
    });

    udpPort.on("message", function (msg) {
        //console.log("📡 OSC besked modtaget:", msg.address, msg.args);

        // Send OSC-data til alle WebSocket-klienter
        if (global.wss) {
            global.wss.clients.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({ address: msg.address, args: msg.args }));
                }
            });
        }
    });

    udpPort.open();
}

module.exports = startOSC