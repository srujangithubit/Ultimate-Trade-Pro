/**
 * AlertService - In-memory price alert engine.
 *
 * Listens to tick events from the MT5Gateway and fires when price
 * crosses an alert level.  Alerts are per-client (identified by a
 * client-provided or server-generated id).
 *
 * Each alert:
 *   { id, symbol, targetPrice, direction, note?, createdAt, triggered }
 *
 * direction is auto-detected on creation:
 *   "above" = alert when ask >= targetPrice   (price rising to level)
 *   "below" = alert when bid <= targetPrice   (price falling to level)
 *   If no current price is available, it defaults to "above".
 */

const crypto = require("crypto");
const EventEmitter = require("events");

class AlertService extends EventEmitter {
  constructor(gateway) {
    super();
    this.gateway = gateway;
    /** @type {Map<string, object>} id -> alert */
    this.alerts = new Map();
    /** @type {Map<string, Set<string>>} symbol -> Set<alertId> */
    this._bySymbol = new Map();
    /** Last known prices per symbol */
    this._lastPrices = new Map();

    // Listen to every tick
    this.gateway.on("tick", (data) => this._onTick(data));
  }

  /**
   * Create a new price alert.
   * @returns {object} the created alert
   */
  create({ symbol, targetPrice, direction, note }) {
    const id = crypto.randomUUID();
    const numPrice = Number(targetPrice);
    if (!symbol || isNaN(numPrice)) {
      throw new Error("symbol and valid targetPrice are required");
    }

    // Auto-detect direction from current price if not specified
    let dir = direction;
    if (!dir) {
      const last = this._lastPrices.get(symbol);
      if (last) {
        dir = numPrice > last.ask ? "above" : "below";
      } else {
        dir = "above";
      }
    }

    const alert = {
      id,
      symbol: symbol.toUpperCase(),
      targetPrice: numPrice,
      direction: dir,
      note: note || null,
      createdAt: new Date().toISOString(),
      triggered: false,
    };

    this.alerts.set(id, alert);

    const sym = alert.symbol;
    if (!this._bySymbol.has(sym)) this._bySymbol.set(sym, new Set());
    this._bySymbol.get(sym).add(id);

    return alert;
  }

  /**
   * Delete an alert by id.
   * @returns {boolean} true if found & deleted
   */
  delete(id) {
    const alert = this.alerts.get(id);
    if (!alert) return false;
    this.alerts.delete(id);
    this._bySymbol.get(alert.symbol)?.delete(id);
    return true;
  }

  /**
   * Update an alert's target price (and optionally direction/note).
   * @returns {object|null} the updated alert, or null if not found
   */
  update(id, { targetPrice, direction, note }) {
    const alert = this.alerts.get(id);
    if (!alert || alert.triggered) return null;

    if (targetPrice != null) {
      alert.targetPrice = Number(targetPrice);
      // Re-detect direction if not explicitly provided
      if (!direction) {
        const last = this._lastPrices.get(alert.symbol);
        if (last) {
          alert.direction = alert.targetPrice > last.ask ? 'above' : 'below';
        }
      }
    }
    if (direction) alert.direction = direction;
    if (note !== undefined) alert.note = note || null;

    return alert;
  }

  /**
   * List all active (non-triggered) alerts, optionally filtered by symbol.
   */
  list(symbol) {
    const results = [];
    for (const a of this.alerts.values()) {
      if (a.triggered) continue;
      if (symbol && a.symbol !== symbol.toUpperCase()) continue;
      results.push(a);
    }
    return results;
  }

  /**
   * Internal: check alerts on every tick.
   */
  _onTick(data) {
    // data shape: { symbol, data: { bid, ask, ... } } or flat { symbol, bid, ask }
    const raw = data?.data ?? data;
    const symbol = (data?.symbol || raw?.symbol || "").toUpperCase();
    const bid = Number(raw?.bid);
    const ask = Number(raw?.ask);
    if (!symbol || isNaN(bid) || isNaN(ask)) return;

    this._lastPrices.set(symbol, { bid, ask });

    const ids = this._bySymbol.get(symbol);
    if (!ids || ids.size === 0) return;

    for (const id of ids) {
      const alert = this.alerts.get(id);
      if (!alert || alert.triggered) continue;

      let hit = false;
      if (alert.direction === "above" && ask >= alert.targetPrice) hit = true;
      if (alert.direction === "below" && bid <= alert.targetPrice) hit = true;

      if (hit) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredPrice = alert.direction === "above" ? ask : bid;

        // Emit so the WS forwarder can push to clients
        this.emit("alert_triggered", {
          id: alert.id,
          symbol: alert.symbol,
          targetPrice: alert.targetPrice,
          triggeredPrice: alert.triggeredPrice,
          direction: alert.direction,
          note: alert.note,
          triggeredAt: alert.triggeredAt,
        });

        // Clean up after trigger
        ids.delete(id);
        this.alerts.delete(id);
      }
    }
  }
}

module.exports = AlertService;
