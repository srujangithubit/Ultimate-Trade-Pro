/**
 * MT5 Router - Express routes for MT5 REST API endpoints.
 */

const express = require("express");
const router = express.Router();

module.exports = function createMT5Router(gateway, alertService, internalApiKey) {
  function requireInternalAuth(req, res, next) {
    if (!internalApiKey) {
      return res.status(503).json({ error: "MT5 bridge auth is not configured" });
    }

    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const token = auth.slice(7);
    if (!token || token !== internalApiKey) {
      return res.status(401).json({ error: "Invalid bearer token" });
    }

    return next();
  }

  // All MT5 bridge routes are internal-only.
  router.use(requireInternalAuth);

  /**
   * POST /mt5/connect - Connect to MT5 account
   */
  router.post("/connect", async (req, res) => {
    try {
      const { server, login, password } = req.body;

      if (!server || !login || !password) {
        return res.status(400).json({ error: "Missing required fields: server, login, password" });
      }

      if (!gateway.connected) {
        return res.status(503).json({ error: "MT5 bridge is not connected" });
      }

      const result = await gateway.authenticate(server, login, password);
      res.json({ success: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /mt5/disconnect - Disconnect from MT5
   */
  router.post("/disconnect", (req, res) => {
    gateway.disconnectMT5();
    res.json({ success: true });
  });

  /**
   * GET /mt5/account - Get account information
   */
  router.get("/account", async (req, res) => {
    try {
      gateway.requestAccountInfo();

      const data = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 10000);
        gateway.once("account_info", (info) => {
          clearTimeout(timeout);
          resolve(info);
        });
      });

      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /mt5/account/:accountNumber - Get account info for a specific account
   * Requires query params: login, password, server
   */
  router.get("/account/:accountNumber", async (req, res) => {
    try {
      const loginRaw = req.query.login || req.params.accountNumber;
      const { password, server } = req.query;
      if (!loginRaw || !server) {
        return res.status(400).json({
          error: "Missing required query params: server (and optional login/password)",
        });
      }

      const login = parseInt(String(loginRaw), 10);
      if (Number.isNaN(login)) {
        return res.status(400).json({ error: "Invalid login" });
      }

      gateway.queryAccount(login, password ? String(password) : undefined, String(server));

      const data = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);
        gateway.once("query_account", (info) => {
          clearTimeout(timeout);
          resolve(info);
        });
      });

      if (!data) {
        return res.status(404).json({ error: "Account not found or login failed" });
      }

      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /mt5/positions/:accountNumber - Get open positions for a specific account
   * Requires query params: login, password, server
   */
  router.get("/positions/:accountNumber", async (req, res) => {
    try {
      const loginRaw = req.query.login || req.params.accountNumber;
      const { password, server } = req.query;
      if (!loginRaw || !server) {
        return res.status(400).json({
          error: "Missing required query params: server (and optional login/password)",
        });
      }

      const login = parseInt(String(loginRaw), 10);
      if (Number.isNaN(login)) {
        return res.status(400).json({ error: "Invalid login" });
      }

      gateway.queryPositions(login, password ? String(password) : undefined, String(server));

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);
        gateway.once("query_positions", (info) => {
          clearTimeout(timeout);
          resolve(info);
        });
      });

      res.json({ data: result.data ?? [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /mt5/positions - Get open positions for the currently connected account
   */
  router.get("/positions", async (req, res) => {
    try {
      gateway.requestPositions();

      const data = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 10000);
        gateway.once("positions", (positions) => {
          clearTimeout(timeout);
          resolve(positions);
        });
      });

      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /mt5/order - Place a market order
   * Body: { symbol, direction, volume, price?, sl?, tp?, slippage?, magic?, comment?, login?, password?, server? }
   */
  router.post("/order", async (req, res) => {
    try {
      const { symbol, direction, volume, price, sl, tp, slippage, magic, comment, login, password, server } = req.body;
      if (!symbol || !direction || !volume) {
        return res.status(400).json({ error: "Missing required fields: symbol, direction, volume" });
      }

      gateway.placeOrder({ symbol, direction, volume, price, sl, tp, slippage, magic, comment, login, password, server });

      const data = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);
        gateway.once("place_order", (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
      });

      if (data && data.retcode === 10009) {
        res.json({ success: true, data });
      } else {
        res.status(422).json({ success: false, data });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * DELETE /mt5/order/:ticket - Close a position
   * Query params: volume? (partial close), slippage?, login?, password?, server?
   */
  router.delete("/order/:ticket", async (req, res) => {
    try {
      const ticket = parseInt(req.params.ticket);
      const { volume, slippage, login, password, server } = req.query;

      gateway.closePosition({
        ticket,
        volume: volume ? parseFloat(volume) : null,
        slippage: slippage ? parseInt(slippage) : 5,
        login: login ? parseInt(login) : null,
        password: password || null,
        server: server || null,
      });

      const data = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);
        gateway.once("close_position", (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
      });

      if (data && data.retcode === 10009) {
        res.json({ success: true, data });
      } else {
        res.status(422).json({ success: false, data });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * PATCH /mt5/order/:ticket - Modify SL/TP of a position
   * Body: { sl?, tp?, login?, password?, server? }
   */
  router.patch("/order/:ticket", async (req, res) => {
    try {
      const ticket = parseInt(req.params.ticket);
      const { sl, tp, login, password, server } = req.body;

      gateway.modifyPosition({ ticket, sl, tp, login, password, server });

      const data = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);
        gateway.once("modify_position", (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
      });

      if (data && data.retcode === 10009) {
        res.json({ success: true, data });
      } else {
        res.status(422).json({ success: false, data });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /mt5/history - Get closed trade history
   */
  router.get("/history", async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      gateway.requestTradeHistory(days);

      const data = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);
        gateway.once("trade_history", (history) => {
          clearTimeout(timeout);
          resolve(history);
        });
      });

      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /mt5/subscribe - Subscribe to symbol ticks
   */
  router.post("/subscribe", (req, res) => {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: "Missing required field: symbol" });
    }
    gateway.subscribe(symbol);
    res.json({ success: true, symbol });
  });

  /**
   * POST /mt5/unsubscribe - Unsubscribe from symbol ticks
   */
  router.post("/unsubscribe", (req, res) => {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: "Missing required field: symbol" });
    }
    gateway.unsubscribe(symbol);
    res.json({ success: true, symbol });
  });

  /**
   * GET /mt5/ohlcv - Get OHLCV candle data
   */
  router.get("/ohlcv", async (req, res) => {
    try {
      const symbol = req.query.symbol || "EURUSD";
      const timeframe = req.query.timeframe || "M5";
      const bars = parseInt(req.query.bars) || 200;

      gateway.requestOHLCV(symbol, timeframe, bars);

      const data = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);
        gateway.once("ohlcv", (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
      });

      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /mt5/status - Get connection status
   */
  router.get("/status", (req, res) => {
    res.json({
      connected: gateway.connected,
      authenticated: gateway.authenticated,
    });
  });

  // ── Price Alerts ────────────────────────────────────────────

  /**
   * POST /mt5/alerts - Create a price alert
   * Body: { symbol, targetPrice, direction?, note? }
   */
  router.post("/alerts", (req, res) => {
    try {
      const { symbol, targetPrice, direction, note } = req.body;
      if (!symbol || targetPrice == null) {
        return res.status(400).json({ error: "Missing required fields: symbol, targetPrice" });
      }
      const alert = alertService.create({ symbol, targetPrice, direction, note });
      res.json({ success: true, alert });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * GET /mt5/alerts - List all active alerts (optional ?symbol=)
   */
  router.get("/alerts", (req, res) => {
    const alerts = alertService.list(req.query.symbol);
    res.json({ alerts });
  });

  /**
   * DELETE /mt5/alerts/:id - Delete an alert
   */
  router.delete("/alerts/:id", (req, res) => {
    const deleted = alertService.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Alert not found" });
    }
    res.json({ success: true });
  });

  /**
   * PATCH /mt5/alerts/:id - Update an alert (move to new price)
   * Body: { targetPrice?, direction?, note? }
   */
  router.patch("/alerts/:id", (req, res) => {
    try {
      const { targetPrice, direction, note } = req.body;
      const alert = alertService.update(req.params.id, { targetPrice, direction, note });
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json({ success: true, alert });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
