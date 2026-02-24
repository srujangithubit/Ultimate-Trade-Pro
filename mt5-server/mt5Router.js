/**
 * MT5 Router - Express routes for MT5 REST API endpoints.
 */

const express = require("express");
const router = express.Router();

module.exports = function createMT5Router(gateway) {
  /**
   * POST /mt5/connect - Connect to MT5 account
   */
  router.post("/connect", async (req, res) => {
    try {
      const { server, login, password } = req.body;

      if (!server || !login || !password) {
        return res.status(400).json({ error: "Missing required fields: server, login, password" });
      }

      await gateway.authenticate(server, login, password);

      // Wait for auth response
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Auth timeout")), 10000);
        gateway.once("auth", (success) => {
          clearTimeout(timeout);
          resolve(success);
        });
      });

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
   * GET /mt5/positions - Get open positions
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
   * GET /mt5/status - Get connection status
   */
  router.get("/status", (req, res) => {
    res.json({
      connected: gateway.connected,
      authenticated: gateway.authenticated,
    });
  });

  return router;
};
