// Loaded with `node --require ./observability/otel.js` so it is set up before Next.js starts.
// Metrics: Prometheus endpoint on :9464/metrics
// Traces:  sent to Jaeger when OTEL_EXPORTER_OTLP_ENDPOINT is set
// Logs:    one JSON line per request, with the trace_id
const { NodeSDK } = require('@opentelemetry/sdk-node')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { UndiciInstrumentation } = require('@opentelemetry/instrumentation-undici')
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus')
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http')
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base')
const { resourceFromAttributes } = require('@opentelemetry/resources')
const { SpanKind } = require('@opentelemetry/api')

// Use the current HTTP metric names (http_server_request_duration).
process.env.OTEL_SEMCONV_STABILITY_OPT_IN ??= 'http'

const version = process.env.APP_VERSION || 'dev'
// Health checks are not user traffic, so leave them out of metrics, traces and logs.
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
  metricReader: new PrometheusExporter({ port: 9464 }),
  spanProcessors,
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (req) => IGNORED_PATHS.has((req.url || '').split('?')[0]),
      // Outgoing calls are covered by the undici (fetch) instrumentation below.
      ignoreOutgoingRequestHook: () => true,
    }),
    new UndiciInstrumentation(),
  ],
})

sdk.start()

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0))
})
