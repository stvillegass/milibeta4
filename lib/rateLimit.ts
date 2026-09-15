/**
 * Rate limiting básico en memoria (sliding window).
 *
 * Pensado para proteger endpoints públicos (p. ej. /api/bookings) contra spam
 * y envíos automatizados masivos. Es una implementación "best effort": en
 * entornos serverless multi-instancia el contador es local a cada instancia,
 * pero frena de forma eficaz ráfagas y bots simples sin dependencias externas.
 */

export type RateLimitOptions = {
  /** Número máximo de peticiones permitidas dentro de la ventana. */
  limit: number;
  /** Tamaño de la ventana en milisegundos. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Peticiones restantes dentro de la ventana actual. */
  remaining: number;
  /** Segundos sugeridos para reintentar (solo cuando ok === false). */
  retryAfterSec: number;
};

/** Almacén de marcas de tiempo por clave (ip, teléfono, etc.). */
const buckets = new Map<string, number[]>();

/** Límite de claves en memoria para evitar crecimiento descontrolado. */
const MAX_TRACKED_KEYS = 5000;

/**
 * Obtiene la IP del cliente a partir de las cabeceras habituales de proxies
 * (Vercel, Cloudflare, nginx...). Devuelve "unknown" si no hay información.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-vercel-forwarded-for") ||
    "unknown"
  );
}

/** Descarta buckets vacíos cuando el almacén crece demasiado. */
function pruneBuckets(now: number, windowMs: number) {
  if (buckets.size <= MAX_TRACKED_KEYS) return;
  for (const [key, hits] of Array.from(buckets.entries())) {
    const alive = hits.filter((t) => now - t < windowMs);
    if (alive.length === 0) buckets.delete(key);
    else buckets.set(key, alive);
  }
}

/**
 * Registra un intento para la clave dada y devuelve si está permitido.
 *
 * @example
 *   const { ok, retryAfterSec } = rateLimit(`booking:${ip}`, { limit: 6, windowMs: 10 * 60_000 });
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  pruneBuckets(now, windowMs);

  const previous = buckets.get(key) || [];
  const hits = previous.filter((t) => t > cutoff);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const oldest = hits[0] ?? now;
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, remaining: Math.max(0, limit - hits.length), retryAfterSec: 0 };
}

/** Reinicia el contador de una clave (útil en pruebas o tras un envío válido). */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}