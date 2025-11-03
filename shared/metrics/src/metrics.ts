import client from "prom-client";

export const registry = client.register;

export const evalLatency = new client.Histogram({
  name: "eval_latency_ms",
  help: "Evaluation latency",
  buckets: [10, 25, 50, 100, 250, 500],
});

export const policyCacheHit = new client.Counter({
  name: "policy_cache_hit_total",
  help: "Policy cache hits",
});
