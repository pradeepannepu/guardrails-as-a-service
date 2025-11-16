import { Kafka } from "kafkajs";
import crypto from "crypto";
import client from "prom-client";
import "../otel/init";

let lastHash = "";

const auditLag = new client.Gauge({
  name: "audit_lag_ms",
  help: "Time between event timestamp and audit processing",
});
const auditCount = new client.Counter({
  name: "audit_events_total",
  help: "Audit events processed",
});

function hashRecord(prev: string, payload: any) {
  return crypto
    .createHash("sha256")
    .update(prev + JSON.stringify(payload))
    .digest("hex");
}

async function main() {
  const kafka = new Kafka({ brokers: [process.env.BROKER_URL!] });
  const consumer = kafka.consumer({ groupId: "audit-logger" });
  await consumer.connect();
  await consumer.subscribe({
    topic: process.env.DECISION_TOPIC || "decision-events",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = JSON.parse(message.value!.toString());
      const newHash = hashRecord(lastHash, payload);
      lastHash = newHash;
      const lag = Date.now() - payload.ts;
      auditLag.set(lag);
      auditCount.inc();
      // Persist (demo): stdout; replace with object storage append-only file.
      console.log(
        JSON.stringify({
          type: "AUDIT_EVENT",
          correlationId: payload.correlationId,
          hash: newHash,
          lagMs: lag,
        })
      );
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import express from "express";
const app = express();
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});
app.listen(process.env.PORT || 3003);
