/**
 * MT5 Gateway - WebSocket client connecting to the Python MT5 bridge.
 * Connects to the Python WebSocket server and exposes API for the Node.js layer.
 */

const WebSocket = require("ws");
const EventEmitter = require("events");

class MT5Gateway extends EventEmitter {
  constructor(pythonWsUrl = "ws://localhost:8765") {
    super();
    this.pythonWsUrl = pythonWsUrl;
    this.ws = null;
    this.connected = false;
    this.authenticated = false;
    this.reconnectInterval = 5000;
    this._reconnectTimer = null;
  }

  /**
   * Connect to the Python MT5 WebSocket server.
   */
  connect() {
    return new Promise((resolve, reject) => {
      let settled = false;

      try {
        this.ws = new WebSocket(this.pythonWsUrl);
      } catch (err) {
        return reject(err);
      }

      this.ws.on("open", () => {
        this.connected = true;
        settled = true;
        console.log("[MT5Gateway] Connected to Python bridge");
        this.emit("connected");
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this._handleMessage(msg);
        } catch (err) {
          console.error("[MT5Gateway] Failed to parse message:", err);
        }
      });

      this.ws.on("close", () => {
        this.connected = false;
        this.authenticated = false;
        console.log("[MT5Gateway] Disconnected from Python bridge");
        this.emit("disconnected");
        this._scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        console.error("[MT5Gateway] WebSocket error:", err.message);
        this.emit("connection_error", err);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
    });
  }

  /**
   * Authenticate with MT5 credentials.
   */
  async authenticate(server, login, password) {
    this._send({
      action: "connect",
      server,
      login,
      password,
    });
  }

  /**
   * Subscribe to tick data for a symbol.
   */
  subscribe(symbol) {
    this._send({ action: "subscribe", symbol });
  }

  /**
   * Unsubscribe from tick data for a symbol.
   */
  unsubscribe(symbol) {
    this._send({ action: "unsubscribe", symbol });
  }

  /**
   * Request account information.
   */
  requestAccountInfo() {
    this._send({ action: "account_info" });
  }

  /**
   * Request open positions.
   */
  requestPositions() {
    this._send({ action: "positions" });
  }

  /**
   * Request trade history (closed trades).
   */
  requestTradeHistory(days = 30) {
    this._send({ action: "trade_history", days });
  }

  /**
   * Disconnect the MT5 terminal session (keeps the Python bridge WebSocket alive).
   * Sends a "disconnect" action to the Python bridge so it calls mt5.shutdown().
   */
  disconnectMT5() {
    this._send({ action: "disconnect" });
    this.authenticated = false;
  }

  /**
   * Fully shut down — close the WebSocket to the Python bridge.
   * Used only for server shutdown, NOT for account switching.
   */
  shutdown() {
    clearTimeout(this._reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.authenticated = false;
  }

  /**
   * Send a JSON message to the Python bridge.
   */
  _send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("[MT5Gateway] Cannot send - not connected");
      return false;
    }
    this.ws.send(JSON.stringify(data));
    return true;
  }

  /**
   * Handle incoming messages from the Python bridge.
   */
  _handleMessage(msg) {
    switch (msg.type) {
      case "auth":
        this.authenticated = msg.success;
        this.emit("auth", msg.success);
        break;
      case "disconnected":
        this.authenticated = false;
        this.emit("mt5_disconnected");
        break;
      case "tick":
        this.emit("tick", { symbol: msg.symbol, data: msg.data });
        break;
      case "account_info":
        this.emit("account_info", msg.data);
        break;
      case "positions":
        this.emit("positions", msg.data);
        break;
      case "trade_history":
        this.emit("trade_history", msg.data);
        break;
      case "subscribed":
        this.emit("subscribed", msg.symbol);
        break;
      case "heartbeat":
        this.emit("heartbeat", msg.timestamp);
        break;
      case "error":
        this.emit("mt5_error", msg.message);
        break;
      default:
        console.warn("[MT5Gateway] Unknown message type:", msg.type);
    }
  }

  /**
   * Schedule a reconnection attempt.
   */
  _scheduleReconnect() {
    this._reconnectTimer = setTimeout(() => {
      console.log("[MT5Gateway] Attempting reconnect...");
      this.connect().catch((err) => {
        console.error("[MT5Gateway] Reconnect failed:", err.message);
      });
    }, this.reconnectInterval);
  }
}

module.exports = MT5Gateway;
