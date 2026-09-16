// Este archivo configura la instrumentación de Sentry en el servidor (Node.js).
// El DSN se lee de las variables de entorno (SENTRY_DSN o NEXT_PUBLIC_SENTRY_DSN).
// Documentación: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Ajusta el nivel de detalle según el entorno
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    debug: false,
  });
}
