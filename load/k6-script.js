import http from "k6/http";
export const options = { vus: 50, duration: "30s" };
export default function () {
  const payload = JSON.stringify({
    resource: { public: false },
    query: "deny public bucket",
  });
  http.post(
    __ENV.EVAL_URL || "http://localhost:3002/evaluate",
    payload,
    { headers: { "Content-Type": "application/json" } }
  );
}
