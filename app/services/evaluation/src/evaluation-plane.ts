import express from "express";
import axios from "axios";
import { Kafka } from "kafkajs";
import crypto from "crypto";
import client from "prom-client";
import "../otel/init";

const app = express();
app.use(express.json());

const kafka = new Kafka({ brokers: [process.env.BROKER_URL!] });
const producer = kafka.producer();

const evalLatency = new client.Histogram({
  name: "eval_latency_ms",
  help: "Evaluation latency (ms)",
  buckets: [10, 25, 50, 100, 200, 400],
});
const decisionCount = new client.Counter({
  name: "decision_events_total",
  help: "Decision events emitted",
});

interface Policy {
  name: string;
  type: string;
  expression: string;
}

type Handler = {
  supports(type: string): boolean;
  evaluate(ctx: any, policy: Policy): Promise<boolean>;
};

const ruleHandler: Handler = {
  supports: (t) => t === "rule",
  evaluate: async (ctx, p) => {
    const fn = new Function("resource", `return (${p.expression});`);
    return !!fn(ctx.resource);
  },
};

const semanticHandler: Handler = {
  supports: (t) => t === "semantic",
  evaluate: async () => true, // stub
};

const handlers: Handler[] = [ruleHandler, semanticHandler];

app.post("/evaluate", async (req, res) => {
  const endTimer = evalLatency.startTimer();
  const correlationId =
    (req.headers["x-corr-id"] as string) || crypto.randomUUID();
  res.setHeader("x-corr-id", correlationId);

  const { resource, query } = req.body;
  const policySvcUrl =
    process.env.POLICY_SVC_URL || "http://policy-svc:3001/policies/search";
  const { data: policies } = await axios.get(policySvcUrl, {
    params: { q: query },
  });

  const decisions = [];
  for (const p of policies as Policy[]) {
    const h = handlers.find((h) => h.supports(p.type));
    if (!h) continue;
    const pass = await h.evaluate({ resource }, p);
    decisions.push({ policy: p.name, pass });
  }

  await producer.connect();
  await producer.send({
    topic: process.env.DECISION_TOPIC || "decision-events",
    messages: [
      {
        key: correlationId,
        value: JSON.stringify({
          correlationId,
          ts: Date.now(),
          decisions,
          resource,
        }),
      },
    ],
  });
  decisionCount.inc();

  endTimer();
  res.json({ correlationId, decisions });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

const port = process.env.PORT || 3002;
app.listen(port, () => console.log(`evaluation-plane listening on ${port}`));
