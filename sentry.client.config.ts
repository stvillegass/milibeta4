// Este archivo configura la instrumentación de Sentry en el cliente.
// El DSN se lee de las variables de entorno (NEXT_PUBLIC_SENTRY_DSN).
// Documentación: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Ajusta el nivel de detalle según el entorno
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    // Ajusta este valor en producción para controlar el volumen de repeticiones
    debug: false,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
  });
}
