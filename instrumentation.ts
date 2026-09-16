// Archivo de instrumentación de Next.js (App Router).
// Next.js cargará este archivo automáticamente al arrancar el servidor.
// Documentación: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export function onRequestError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { captureRequestError } = require("@sentry/nextjs") as typeof import("@sentry/nextjs");
  captureRequestError(error, request, context);
}
