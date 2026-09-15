import { sanitizePhoneNumber } from "@/lib/whatsapp";

/**
 * Helpers de validación y saneamiento estricto para entradas de la API pública.
 * Todo valor que llega del cliente debe pasar por aquí antes de tocar Supabase.
 */

/** Caracteres de control (incluye saltos de línea y NULL). */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
/** Etiquetas HTML (<script>, <img ...>, etc.). */
const HTML_TAGS = /<[^>]*>/g;
/** Protocolos peligrosos (javascript:, vbscript:, data:). */
const DANGEROUS_PROTOCOL = /(javascript|vbscript|data)\s*:/gi;

/** UUID v1-v5 en formato canónico. */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nombre de persona: letras (con acentos), espacios, apóstrofes, puntos y guiones. */
const CLIENT_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u;

/** Formatos de fecha ISO 8601 aceptados (con o sin zona horaria). */
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Límites de negocio. */
export const LIMITS = {
  nameMax: 80,
  nameMin: 2,
  phoneDigitsMin: 10,
  phoneDigitsMax: 15,
  maxComboServices: 3,
  maxPrice: 100_000,
  minDurationMinutes: 5,
  maxDurationMinutes: 600,
  /** Tolerancia hacia atrás para la hora de inicio (reservas recién creadas). */
  startTimeToleranceMs: 10 * 60_000,
  maxFutureMs: 365 * 24 * 60 * 60_000,
} as const;

/**
 * Limpia un texto libre: elimina caracteres de control, etiquetas HTML,
 * protocolos peligrosos, colapsa espacios y recorta a `maxLen`.
 */
export function sanitizeText(value: unknown, maxLen = 120): string {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL_CHARS, " ")
    .replace(HTML_TAGS, "")
    .replace(DANGEROUS_PROTOCOL, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Devuelve solo los dígitos de una cadena (con longitud máxima). */
export function digitsOnly(value: unknown, maxLen = 20): string {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "").slice(0, maxLen);
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isValidClientName(value: string): boolean {
  return (
    value.length >= LIMITS.nameMin &&
    value.length <= LIMITS.nameMax &&
    CLIENT_NAME_PATTERN.test(value)
  );
}

/**
 * Valida un teléfono y devuelve su forma normalizada (58XXXXXXXXXX).
 * Acepta números venezolanos normalizados o cualquier número de 10-15 dígitos.
 */
export function normalizeAndValidatePhone(
  value: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: "El teléfono es obligatorio" };
  }

  const digits = digitsOnly(value, 20);
  if (digits.length < LIMITS.phoneDigitsMin) {
    return { ok: false, error: "El teléfono debe tener al menos 10 dígitos" };
  }

  const normalized = sanitizePhoneNumber(digits);
  if (!normalized || normalized.length > LIMITS.phoneDigitsMax + 1) {
    return { ok: false, error: "El teléfono no tiene un formato válido" };
  }
  if (!/^\d{10,15}$/.test(normalized)) {
    return { ok: false, error: "El teléfono no tiene un formato válido" };
  }

  return { ok: true, value: normalized };
}

/** Valida que una cadena sea una fecha/hora ISO 8601 real y parseable. */
export function parseIsoDateTime(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO_DATE_TIME_PATTERN.test(value.trim())) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Número finito dentro de un rango. Devuelve null si no es válido. */
export function parseNumberInRange(
  value: unknown,
  min: number,
  max: number
): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

/** Tamaño máximo aceptado del cuerpo JSON de una reserva (16 KB). */
export const MAX_BODY_BYTES = 16 * 1024;

/** Estados permitidos para reservas creadas desde la vista pública. */
export const PUBLIC_BOOKING_STATUSES = ["pending", "confirmed"] as const;

export interface ComboServiceInput {
  service_id: string | null;
  service_name: string;
  option_name: string;
  price: number;
  duration_minutes: number;
}

export interface ValidatedBooking {
  client_name: string;
  client_phone: string;
  service_id: string;
  service_option_id: string;
  service_name: string;
  option_name: string;
  start_time: string;
  end_time: string | null;
  status: (typeof PUBLIC_BOOKING_STATUSES)[number];
  combo_services: ComboServiceInput[];
  total_price: number;
  duration_minutes: number;
  fecha: string;
  hora: string;
}

export type BookingValidation =
  | { ok: true; value: ValidatedBooking }
  | { ok: false; errors: string[] };

/**
 * Validación estricta del body de POST /api/bookings.
 *
 * Además de validar, devuelve una versión saneada de cada campo para que el
 * endpoint nunca escriba en Supabase datos sin limpiar.
 */
export function validateBookingPayload(payload: unknown): BookingValidation {
  const errors: string[] = [];

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, errors: ["El cuerpo de la petición debe ser un objeto JSON"] };
  }

  const body = payload as Record<string, unknown>;

  // ── Nombre del cliente ──
  const clientName = sanitizeText(body.client_name, LIMITS.nameMax);
  if (!clientName) errors.push("El nombre es obligatorio");
  else if (!isValidClientName(clientName))
    errors.push("El nombre contiene caracteres no permitidos (2 a 80 letras)");

  // ── Teléfono ──
  const phone = normalizeAndValidatePhone(body.client_phone);
  if (!phone.ok) errors.push(phone.error);

  // ── Identificadores (UUID) ──
  if (!isValidUuid(body.service_id)) errors.push("El servicio seleccionado no es válido");
  if (!isValidUuid(body.service_option_id))
    errors.push("La modalidad seleccionada no es válida");

  // ── Fechas ──
  const startDate = parseIsoDateTime(body.start_time);
  const hasEndTime = body.end_time !== undefined && body.end_time !== null;
  const endDate = hasEndTime ? parseIsoDateTime(body.end_time) : null;

  if (!startDate) {
    errors.push("La fecha de inicio no tiene un formato válido");
  } else {
    const now = Date.now();
    if (startDate.getTime() < now - LIMITS.startTimeToleranceMs)
      errors.push("La fecha de inicio no puede estar en el pasado");
    if (startDate.getTime() > now + LIMITS.maxFutureMs)
      errors.push("La fecha de inicio está demasiado lejos en el futuro");
  }

  if (hasEndTime && !endDate) errors.push("La fecha de fin no tiene un formato válido");

  if (startDate && endDate) {
    const diff = endDate.getTime() - startDate.getTime();
    if (diff <= 0) errors.push("La fecha de fin debe ser posterior a la de inicio");
    else if (diff > LIMITS.maxDurationMinutes * 60_000)
      errors.push("La duración de la reserva excede el máximo permitido");
  }

  // ── Estado ──
  const requestedStatus = body.status === undefined ? "confirmed" : body.status;
  if (
    typeof requestedStatus !== "string" ||
    !(PUBLIC_BOOKING_STATUSES as readonly string[]).includes(requestedStatus)
  ) {
    errors.push("El estado de la reserva no es válido");
  }
  // ── Servicios combinados ──
  const comboRaw = body.combo_services;
  const combo_services: ComboServiceInput[] = [];
  if (comboRaw !== undefined) {
    if (!Array.isArray(comboRaw)) {
      errors.push("Los servicios combinados deben ser una lista");
    } else if (comboRaw.length > LIMITS.maxComboServices) {
      errors.push(`No se pueden combinar más de ${LIMITS.maxComboServices} servicios`);
    } else {
      comboRaw.forEach((raw, idx) => {
        if (typeof raw !== "object" || raw === null) {
          errors.push(`El servicio adicional #${idx + 1} no es válido`);
          return;
        }
        const item = raw as Record<string, unknown>;
        const serviceName = sanitizeText(item.service_name, LIMITS.nameMax);
        const optionName = sanitizeText(item.option_name, LIMITS.nameMax);
        const price = parseNumberInRange(item.price, 0, LIMITS.maxPrice);
        const duration = parseNumberInRange(
          item.duration_minutes,
          0,
          LIMITS.maxDurationMinutes
        );

        if (!serviceName) {
          errors.push(`El servicio adicional #${idx + 1} no tiene un nombre válido`);
          return;
        }
        if (price === null) {
          errors.push(`El precio del servicio adicional #${idx + 1} no es válido`);
          return;
        }
        if (duration === null) {
          errors.push(`La duración del servicio adicional #${idx + 1} no es válida`);
          return;
        }

        combo_services.push({
          service_id: isValidUuid(item.service_id) ? item.service_id : null,
          service_name: serviceName,
          option_name: optionName,
          price,
          duration_minutes: duration,
        });
      });
    }
  }

  // ── Totales ─
  const calculatedExtras = combo_services.reduce((sum, c) => sum + c.price, 0);
  const totalPriceRaw = parseNumberInRange(body.total_price, 0, LIMITS.maxPrice);
  if (body.total_price !== undefined && totalPriceRaw === null)
    errors.push("El precio total no es válido");

  const durationRaw = parseNumberInRange(
    body.duration_minutes,
    LIMITS.minDurationMinutes,
    LIMITS.maxDurationMinutes
  );
  if (body.duration_minutes !== undefined && durationRaw === null)
    errors.push("La duración total no es válida");

  // ── Textos informativos (solo para WhatsApp) ──
  const fecha = sanitizeText(body.fecha, 60);
  const hora = sanitizeText(body.hora, 30);

  if (errors.length > 0) return { ok: false, errors };
  if (!phone.ok || !startDate) return { ok: false, errors: ["Datos de reserva inválidos"] };

  return {
    ok: true,
    value: {
      client_name: clientName,
      client_phone: phone.value,
      service_id: body.service_id as string,
      service_option_id: body.service_option_id as string,
      service_name: sanitizeText(body.service_name, LIMITS.nameMax),
      option_name: sanitizeText(body.option_name, LIMITS.nameMax),
      start_time: startDate.toISOString(),
      end_time: endDate ? endDate.toISOString() : null,
      status: requestedStatus as (typeof PUBLIC_BOOKING_STATUSES)[number],
      combo_services,
      total_price: totalPriceRaw === null ? calculatedExtras : totalPriceRaw,
      duration_minutes: durationRaw ?? LIMITS.minDurationMinutes,
      fecha,
      hora,
    },
  };
}