import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

if (!global.__OTEL_STARTED) {
  const sdk = new NodeSDK({
    serviceName: process.env.SERVICE_NAME || "guardrails-service",
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  // @ts-ignore
  global.__OTEL_STARTED = true;
}
