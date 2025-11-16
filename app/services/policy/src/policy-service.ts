import express from "express";
import { Pool } from "pg";
import Redis from "ioredis";
import client from "prom-client";
import "../../../shared/otel/init"; 

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.POLICY_DB_URL });
const redis = new Redis(process.env.REDIS_URL!);

const cacheHit = new client.Counter({
  name: "policy_cache_hit_total",
  help: "Policy cache hits",
});
const cacheMiss = new client.Counter({
  name: "policy_cache_miss_total",
  help: "Policy cache misses",
});
const policyCreate = new client.Counter({
  name: "policy_create_total",
  help: "Policies created",
});

app.post("/policies", async (req, res) => {
  const { name, type, expression, embedding } = req.body;
  await pool.query(
    "INSERT INTO policies(name,type,expression,embedding) VALUES($1,$2,$3,$4)",
    [name, type, expression, embedding]
  );
  policyCreate.inc();
  res.status(201).json({ id: name });
});

app.get("/policies/search", async (req, res) => {
  const q = req.query.q as string;
  // For demo: treat q as raw vector literal or precomputed embedding id
  const { rows } = await pool.query(
    "SELECT name,type,expression FROM policies ORDER BY embedding <-> $1::vector LIMIT 5",
    [q]
  );
  res.json(rows);
});

app.get("/policies/:name", async (req, res) => {
  const key = `policy:${req.params.name}`;
  const cached = await redis.get(key);
  if (cached) {
    cacheHit.inc();
    return res.json(JSON.parse(cached));
  }
  cacheMiss.inc();
  const { rows } = await pool.query("SELECT * FROM policies WHERE name=$1", [
    req.params.name,
  ]);
  if (!rows[0]) return res.status(404).end();
  await redis.setex(key, 120, JSON.stringify(rows[0]));
  res.json(rows[0]);
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`policy-svc listening on ${port}`));
