/**
 * MT5 Gateway - WebSocket client connecting to the Python MT5 bridge.
 * Connects to the Python WebSocket server and exposes API for the Node.js layer.
 */

const WebSocket = require("ws");
const EventEmitter = require("events");

class MT5Gateway extends EventEmitter {
  constructor(pythonWsUrl = "ws://localhost:8765") {
    super();
    this.setMaxListeners(50);
    this.pythonWsUrl = pythonWsUrl;
    this.ws = null;
    this.connected = false;
    this.authenticated = false;
    this.reconnectInterval = 5000;
    this._reconnectTimer = null;
    // Reference counting for subscriptions: symbol -> count
    this._subCounts = {};
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
        // Re-subscribe all active symbols after reconnect
        for (const symbol of Object.keys(this._subCounts)) {
          if (this._subCounts[symbol] > 0) {
            this._send({ action: "subscribe", symbol });
          }
        }
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
   * Returns a promise that resolves to true/false based on auth success.
   */
  authenticate(server, login, password) {
    return new Promise((resolve, reject) => {
      const sent = this._send({
        action: "connect",
        server,
        login,
        password,
      });
      if (!sent) {
        return reject(new Error("Python bridge is not connected"));
      }
      const timeout = setTimeout(() => resolve(false), 10000);
      this.once("auth", (success) => {
        clearTimeout(timeout);
        resolve(success);
      });
    });
  }

  /**
   * Subscribe to tick data for a symbol (reference counted).
   * Only sends to Python bridge on first subscriber.
   */
  subscribe(symbol) {
    this._subCounts[symbol] = (this._subCounts[symbol] || 0) + 1;
    if (this._subCounts[symbol] === 1) {
      // First subscriber — actually subscribe on the bridge
      this._send({ action: "subscribe", symbol });
    }
  }

  /**
   * Unsubscribe from tick data for a symbol (reference counted).
   * Only sends to Python bridge when last subscriber leaves.
   */
  unsubscribe(symbol) {
    if (!this._subCounts[symbol]) return;
    this._subCounts[symbol]--;
    if (this._subCounts[symbol] <= 0) {
      delete this._subCounts[symbol];
      this._send({ action: "unsubscribe", symbol });
    }
  }

  /**
   * Request account information.
   */
  requestAccountInfo() {
    this._send({ action: "account_info" });
  }

  /**
   * Request open positions for the currently connected account.
   */
  requestPositions() {
    this._send({ action: "positions" });
  }

  /**
   * Query open positions for a specific MT5 account.
   * Temporarily switches the terminal to the target account then switches back.
   */
  queryPositions(login, password, server) {
    this._send({ action: "query_positions", login, password, server });
  }

  /**
   * Request trade history (closed trades).
   */
  requestTradeHistory(days = 30) {
    this._send({ action: "trade_history", days });
  }

  /**
   * Request OHLCV candle data for a symbol/timeframe.
   */
  requestOHLCV(symbol, timeframe = "M5", bars = 200) {
    this._send({ action: "ohlcv", symbol, timeframe, bars });
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
   * Query account info for a specific MT5 account.
   * Temporarily switches the terminal to the target account then switches back.
   */
  queryAccount(login, password, server) {
    this._send({ action: "query_account", login, password, server });
  }

  /**
   * Place a market order on the currently connected account or a specified account.
   */
  placeOrder({ symbol, direction, volume, price, sl, tp, slippage, magic, comment, login, password, server }) {
    this._send({
      action: "place_order",
      symbol, direction, volume, price, sl, tp,
      slippage: slippage || 5,
      magic: magic || 123456,
      comment: comment || "TradePro_Sync",
      login: login || null,
      password: password || null,
      server: server || null,
    });
  }

  /**
   * Close an open position by ticket.
   */
  closePosition({ ticket, volume, slippage, login, password, server }) {
    this._send({
      action: "close_position",
      ticket,
      volume: volume || null,
      slippage: slippage || 5,
      login: login || null,
      password: password || null,
      server: server || null,
    });
  }

  /**
   * Modify SL/TP of an open position.
   */
  modifyPosition({ ticket, sl, tp, login, password, server }) {
    this._send({
      action: "modify_position",
      ticket,
      sl: sl !== undefined ? sl : null,
      tp: tp !== undefined ? tp : null,
      login: login || null,
      password: password || null,
      server: server || null,
    });
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
      case "ohlcv":
        this.emit("ohlcv", msg);
        break;
      case "query_account":
        this.emit("query_account", msg.data);
        break;
      case "query_positions":
        this.emit("query_positions", { login: msg.login, data: msg.data });
        break;
      case "place_order":
        this.emit("place_order", msg.data);
        break;
      case "close_position":
        this.emit("close_position", msg.data);
        break;
      case "modify_position":
        this.emit("modify_position", msg.data);
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
