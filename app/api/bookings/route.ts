import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendWhatsAppConfirmation,
  sanitizePhoneNumber,
} from "@/lib/whatsapp";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import {
  MAX_BODY_BYTES,
  validateBookingPayload,
} from "@/lib/validation";

// Runtime Node.js (necesario para el cliente Supabase y el fetch a la Evolution API)
export const runtime = "nodejs";

/** Respuestas de reserva: datos vivos, nunca cacheados. */
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

/** Límites de tasa para el endpoint público de reservas. */
const RATE_LIMIT = {
  /** Máximo de reservas por IP dentro de la ventana. */
  ipLimit: 5,
  windowMs: 10 * 60_000,
  /** Máximo de reservas por número de teléfono dentro de la ventana. */
  phoneLimit: 3,
  phoneWindowMs: 30 * 60_000,
} as const;

// Deshabilitar caché: cada reserva es una escritura real
export const dynamic = "force-dynamic";

interface CreateBookingBody {
  client_name: string;
  client_phone: string;
  service_id: string;
  service_option_id: string;
  service_name?: string;
  option_name?: string;
  start_time: string;
  end_time?: string;
  status?: string;
  // Servicios combinados (Manicure + Pedicure + Cejas) que acompañan a la reserva
  combo_services?: {
    service_id?: string;
    service_name?: string;
    option_name?: string;
    price?: number;
    duration_minutes?: number;
  }[];
  total_price?: number;
  duration_minutes?: number;
  // Fecha/hora pre-formateadas (lenguaje local de la clienta) para el WhatsApp
  fecha?: string;
  hora?: string;
}

/**
 * Crea una nueva reserva y envía automáticamente el mensaje de confirmación por WhatsApp.
 *
 * El envío de WhatsApp se ejecuta DESPUÉS de guardar exitosamente la cita y dentro de un
 * try/catch: si falla por cualquier motivo, la cita igual queda guardada y se responde éxito,
 * registrando el error en los logs sin tumbar el flujo.
 */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "❌ ERROR: Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)."
    );
    return NextResponse.json(
      { error: "Configuración de Supabase incompleta" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 0) Límite de tamaño del cuerpo (evita payloads gigantes antes de parsear)
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "La solicitud es demasiado grande" },
      { status: 413, headers: NO_STORE_HEADERS }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // 1) Validación estricta de TODOS los campos entrantes (nombre, teléfono,
  //    UUIDs, fechas ISO, estado, combos, precios y duraciones).
  const validation = validateBookingPayload(rawBody);
  if (!validation.ok) {
    console.warn("[POST /api/bookings] Payload rechazado:", validation.errors);
    return NextResponse.json(
      { error: "Datos de reserva inválidos", details: validation.errors },
      { status: 422, headers: NO_STORE_HEADERS }
    );
  }

  const body = validation.value;

  // 2) Rate limiting: frena spam y envíos automatizados masivos.
  //    - Por IP: evita ráfagas desde un mismo origen.
  //    - Por teléfono: evita que un mismo número genere citas duplicadas.
  const clientIp = getClientIp(request);
  const ipLimitResult = rateLimit(`bookings:ip:${clientIp}`, {
    limit: RATE_LIMIT.ipLimit,
    windowMs: RATE_LIMIT.windowMs,
  });
  if (!ipLimitResult.ok) {
    console.warn("[POST /api/bookings] Rate limit alcanzado para IP:", clientIp);
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          "Retry-After": String(ipLimitResult.retryAfterSec),
        },
      }
    );
  }

  const phoneLimitResult = rateLimit(
    `bookings:phone:${body.client_phone}`,
    { limit: RATE_LIMIT.phoneLimit, windowMs: RATE_LIMIT.phoneWindowMs }
  );
  if (!phoneLimitResult.ok) {
    console.warn(
      "[POST /api/bookings] Rate limit alcanzado para el teléfono:",
      body.client_phone
    );
    return NextResponse.json(
      { error: "Ya registramos varias reservas con este número. Intenta más tarde." },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          "Retry-After": String(phoneLimitResult.retryAfterSec),
        },
      }
    );
  }

  console.log("🟡 [POST /api/bookings] Payload validado:", { tel: "****" + body.client_phone.slice(-4), combos: body.combo_services.length });
  console.log("🟡 [POST /api/bookings] Env vars WhatsApp:", {
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || "(vacío)",
    EVOLUTION_INSTANCE_NAME: process.env.EVOLUTION_INSTANCE_NAME || "(vacío)",
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY
      ? `${process.env.EVOLUTION_API_KEY.slice(0, 3)}...${process.env.EVOLUTION_API_KEY.slice(-3)}`
      : "(vacío)",
  });

  // 3) Persistencia: todos los campos ya vienen saneados, validados y normalizados
  //    por validateBookingPayload() (nombre, teléfono, UUIDs, fechas, combos).

  // 1) Guardar la cita en Supabase (teléfono normalizado a formato internacional 58412XXXXXXX)
  const normalizedPhone = sanitizePhoneNumber(body.client_phone);
  console.log("🟡 [POST /api/bookings] Teléfono normalizado para guardar/enviar:", {
    recibido: body.client_phone,
    normalizado: normalizedPhone,
  });

  // Servicios combinados: ya validados y normalizados por validateBookingPayload()
  const comboList = body.combo_services;

  const { data, error } = await admin
    .from("bookings")
    .insert({
      client_name: body.client_name,
      client_phone: normalizedPhone,
      service_id: body.service_id,
      service_option_id: body.service_option_id,
      start_time: body.start_time,
      end_time: body.end_time,
      status: body.status,
      combo_services: comboList,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("❌ ERROR creando reserva:", error);
    return NextResponse.json(
      { error: "Error al guardar la reserva" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  console.log("✅ Reserva guardada correctamente (id:", data.id, ")");
  if (comboList.length > 0) {
    console.log(
      "✅ Servicios combinados persistidos en combo_services:",
      comboList.map((c) => `${c.service_name} (${c.option_name})`)
    );
  }

  // 2) Enviar confirmación de WhatsApp (sin tumbar el flujo si falla)
  try {
    const serviceName = body.service_name || "tu servicio";
    const optionName = body.option_name;
    // Combinaciones: "Manicure (Clásico) + Pedicure (Spa) + Cejas (Laminado)"
    const combos = comboList.map((c) =>
      c.option_name ? `${c.service_name} (${c.option_name})` : String(c.service_name)
    );
    const displayName = [
      optionName ? `${serviceName} (${optionName})` : serviceName,
      ...combos,
    ].join(" + ");

    const sent = await sendWhatsAppConfirmation(
      normalizedPhone || body.client_phone,
      body.client_name,
      displayName,
      {
        fecha: body.fecha,
        hora: body.hora,
        startTime: body.start_time,
        supabase: admin,
      }
    );

    if (!sent) {
      console.warn(
        "⚠️ No se pudo enviar la confirmación de WhatsApp (la cita ya fue guardada)."
      );
    }
  } catch (waError) {
    // El envío de WhatsApp nunca debe impedir que la cita se guarde / responda éxito.
    console.error(
      "❌ Error enviando confirmación de WhatsApp (la cita ya fue guardada correctamente):",
      waError
    );
  }

  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}