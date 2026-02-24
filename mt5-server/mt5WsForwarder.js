/**
 * MT5 WebSocket Forwarder - Forwards MT5 events to frontend clients via WebSocket.
 */

const WebSocket = require("ws");

class MT5WsForwarder {
  constructor(gateway, options = {}) {
    this.gateway = gateway;
    this.port = options.port || 8080;
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * Start the WebSocket server for frontend clients.
   */
  start(server) {
    this.wss = new WebSocket.Server({ server, path: "/ws/mt5" });

    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      console.log(`[MT5WsForwarder] Client connected (${this.clients.size} total)`);

      // Send current status on connect
      ws.send(
        JSON.stringify({
          type: "status",
          connected: this.gateway.connected,
          authenticated: this.gateway.authenticated,
        })
      );

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this._handleClientMessage(ws, msg);
        } catch (err) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log(`[MT5WsForwarder] Client disconnected (${this.clients.size} total)`);
      });
    });

    // Forward gateway events to all connected frontend clients
    this._setupForwarding();

    console.log("[MT5WsForwarder] WebSocket forwarder started on /ws/mt5");
  }

  /**
   * Handle messages from frontend clients.
   */
  _handleClientMessage(ws, msg) {
    switch (msg.action) {
      case "subscribe":
        this.gateway.subscribe(msg.symbol);
        break;
      case "unsubscribe":
        this.gateway.unsubscribe(msg.symbol);
        break;
      case "account_info":
        this.gateway.requestAccountInfo();
        break;
      case "positions":
        this.gateway.requestPositions();
        break;
      case "trade_history":
        this.gateway.requestTradeHistory(msg.days || 30);
        break;
      default:
        ws.send(JSON.stringify({ type: "error", message: `Unknown action: ${msg.action}` }));
    }
  }

  /**
   * Setup event forwarding from gateway to frontend clients.
   */
  _setupForwarding() {
    const events = ["tick", "account_info", "positions", "trade_history", "auth", "subscribed", "heartbeat", "mt5_error"];

    events.forEach((event) => {
      this.gateway.on(event, (data) => {
        const message = JSON.stringify({ type: event, data });
        this._broadcast(message);
      });
    });

    this.gateway.on("connected", () => {
      this._broadcast(JSON.stringify({ type: "status", connected: true }));
    });

    this.gateway.on("disconnected", () => {
      this._broadcast(JSON.stringify({ type: "status", connected: false, authenticated: false }));
    });
  }

  /**
   * Broadcast a message to all connected frontend clients.
   */
  _broadcast(message) {
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Stop the WebSocket server.
   */
  stop() {
    if (this.wss) {
      this.wss.close();
    }
  }
}

module.exports = MT5WsForwarder;
