const express = require("express");
const pino = require("pino");
const pinoHttp = require("pino-http");
const client = require("prom-client");

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const port = Number(process.env.PORT || 3000);
let isReady = true;

const register = new client.Registry();
client.collectDefaultMetrics({ register });

app.use(express.json());
app.use(pinoHttp({ logger }));

app.get("/", (req, res) => {
  res.json({
    service: "platform-demo-app",
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/readyz", (req, res) => {
  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "not-ready"
  });
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

const server = app.listen(port, () => {
  logger.info({ port }, "server started");
});

function shutdown(signal) {
  logger.info({ signal }, "shutdown requested");
  isReady = false;

  server.close(() => {
    logger.info("server stopped");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("forced shutdown");
    process.exit(1);
  }, 10000).unref();
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});
