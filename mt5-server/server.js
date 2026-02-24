/**
 * MT5 Node Server - Express + WebSocket server for MT5 live integration.
 * 
 * This server bridges the frontend to the Python MT5 bridge.
 * Architecture: Frontend <-> Node Server (port 3001) <-> Python Bridge (port 8765) <-> MT5 Terminal
 */

const express = require("express");
const http = require("http");
const cors = require("cors");
const MT5Gateway = require("./mt5Gateway");
const createMT5Router = require("./mt5Router");
const MT5WsForwarder = require("./mt5WsForwarder");

const PORT = process.env.MT5_NODE_PORT || 3001;
const PYTHON_WS_URL = process.env.MT5_PYTHON_WS_URL || "ws://localhost:8765";

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

  // Setup REST routes
  const mt5Router = createMT5Router(gateway);
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
  const wsForwarder = new MT5WsForwarder(gateway);
  wsForwarder.start(server);

  // Connect to Python bridge
  try {
    await gateway.connect();
    console.log("[Server] Connected to MT5 Python bridge");
  } catch (err) {
    console.warn("[Server] Could not connect to Python bridge (will retry):", err.message);
  }

  // Start server
  server.listen(PORT, () => {
    console.log(`[Server] MT5 Node server running on port ${PORT}`);
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
