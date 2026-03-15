/**
 * MT5 Node Server - Express + WebSocket server for MT5 live integration.
 * 
 * This server bridges the frontend to the Python MT5 bridge.
 * Architecture: Frontend <-> Node Server (port 3001) <-> Python Bridge (port 8765) <-> MT5 Terminal
 */

require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const MT5Gateway = require("./mt5Gateway");
const createMT5Router = require("./mt5Router");
const MT5WsForwarder = require("./mt5WsForwarder");
const AlertService = require("./alertService");

const PORT = process.env.MT5_NODE_PORT || 3001;
const HOST = process.env.MT5_NODE_HOST || "127.0.0.1";
const PYTHON_WS_URL = process.env.MT5_PYTHON_WS_URL || "ws://localhost:8765";
const INTERNAL_API_KEY = process.env.MT5_INTERNAL_API_KEY || "";

if (!INTERNAL_API_KEY) {
  throw new Error("MT5_INTERNAL_API_KEY is required to start mt5-server");
}

// Master MT5 credentials for reliable connection
const MASTER_MT5_LOGIN = process.env.MASTER_MT5_LOGIN;
const MASTER_MT5_PASSWORD = process.env.MASTER_MT5_PASSWORD;
const MASTER_MT5_SERVER = process.env.MASTER_MT5_SERVER;

async function main() {
  // Initialize Express
  const app = express();
  app.use(cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3002",
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
  }));
  app.use(express.json());

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize MT5 Gateway
  const gateway = new MT5Gateway(PYTHON_WS_URL);

  // Initialize Alert Service
  const alertService = new AlertService(gateway);

  // Setup REST routes
  const mt5Router = createMT5Router(gateway, alertService, INTERNAL_API_KEY);
  app.use("/api/mt5", mt5Router);

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      mt5Connected: gateway.connected,
      mt5Authenticated: gateway.authenticated,
      uptime: process.uptime(),
    });
  });

  // Setup WebSocket forwarder for frontend
  const wsForwarder = new MT5WsForwarder(gateway, alertService, {
    internalApiKey: INTERNAL_API_KEY,
  });
  wsForwarder.start(server);

  // Helper: authenticate with master MT5 account so credentials are
  // stored in the Python bridge for reliable switch-back after slave trades.
  async function authenticateMaster() {
    if (!MASTER_MT5_LOGIN || !MASTER_MT5_PASSWORD || !MASTER_MT5_SERVER) return;
    const authOk = await gateway.authenticate(
      MASTER_MT5_SERVER,
      parseInt(MASTER_MT5_LOGIN, 10),
      MASTER_MT5_PASSWORD,
    );
    if (authOk) {
      console.log(`[Server] Authenticated with master MT5 account ${MASTER_MT5_LOGIN}`);
    } else {
      console.warn(`[Server] Failed to authenticate with master MT5 account ${MASTER_MT5_LOGIN}`);
    }
  }

  // Re-authenticate after every reconnect to the Python bridge
  gateway.on("connected", () => {
    authenticateMaster().catch((err) =>
      console.warn("[Server] Re-auth after reconnect failed:", err.message),
    );
  });

  // Connect to Python bridge
  try {
    await gateway.connect();
    console.log("[Server] Connected to MT5 Python bridge");
  } catch (err) {
    console.warn("[Server] Could not connect to Python bridge (will retry):", err.message);
  }

  // Start server
  server.listen(PORT, HOST, () => {
    console.log(`[Server] MT5 Node server running on ${HOST}:${PORT}`);
    console.log(`[Server] REST API: http://localhost:${PORT}/api/mt5`);
    console.log(`[Server] WebSocket: ws://localhost:${PORT}/ws/mt5`);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[Server] Shutting down...");
    gateway.shutdown();
    wsForwarder.stop();
    server.close(() => process.exit(0));
  });
}

main().catch(console.error);
