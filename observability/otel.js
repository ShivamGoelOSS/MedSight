// Preloaded with `node --require ./observability/otel.js` so instrumentation is
// registered before Next.js loads `http`. Provides:
//   - metrics: Prometheus endpoint on :9464/metrics (HTTP server + outbound Gemini calls)
//   - traces:  OTLP/HTTP export to Jaeger (only when OTEL_EXPORTER_OTLP_ENDPOINT is set)
//   - logs:    one JSON access-log line per request, carrying the trace_id
const { NodeSDK } = require('@opentelemetry/sdk-node')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { UndiciInstrumentation } = require('@opentelemetry/instrumentation-undici')
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus')
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http')
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base')
const { resourceFromAttributes } = require('@opentelemetry/resources')
const { SpanKind } = require('@opentelemetry/api')

// Emit stable HTTP semantic-convention metrics (http_server_request_duration_seconds).
process.env.OTEL_SEMCONV_STABILITY_OPT_IN ??= 'http'

const version = process.env.APP_VERSION || 'dev'
// Probe and scrape traffic is not user traffic: keep it out of metrics, traces and logs.
const IGNORED_PATHS = new Set(['/api/health', '/api/ready', '/favicon.ico'])

const accessLog = {
  onStart() {},
  onEnd(span) {
    if (span.kind !== SpanKind.SERVER || !span.attributes['http.request.method']) return
    console.log(JSON.stringify({
      time: new Date().toISOString(),
      level: 'info',
      msg: 'request',
      method: span.attributes['http.request.method'],
      path: span.attributes['url.path'],
      status: span.attributes['http.response.status_code'],
      duration_ms: Math.round(span.duration[0] * 1e3 + span.duration[1] / 1e6),
      trace_id: span.spanContext().traceId,
      version,
    }))
  },
  forceFlush: async () => {},
  shutdown: async () => {},
}

const spanProcessors = [accessLog]
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  spanProcessors.push(new BatchSpanProcessor(new OTLPTraceExporter()))
}

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': process.env.OTEL_SERVICE_NAME || 'medsight',
    'service.version': version,
  }),
  metricReader: new PrometheusExporter({ port: Number(process.env.METRICS_PORT || 9464) }),
  spanProcessors,
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (req) => IGNORED_PATHS.has((req.url || '').split('?')[0]),
      // Only outbound fetch (undici) matters; skip the raw http client to avoid duplicates.
      ignoreOutgoingRequestHook: () => true,
    }),
    new UndiciInstrumentation(),
  ],
})

sdk.start()
console.log(JSON.stringify({ time: new Date().toISOString(), level: 'info', msg: 'telemetry started', version }))

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0))
})
