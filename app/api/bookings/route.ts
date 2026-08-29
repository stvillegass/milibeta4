import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendWhatsAppConfirmation,
  sanitizePhoneNumber,
} from "@/lib/whatsapp";

// Runtime Node.js (necesario para el cliente Supabase y el fetch a la Evolution API)
export const runtime = "nodejs";

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
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: CreateBookingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  console.log("🟡 [POST /api/bookings] Body recibido:", body);
  console.log("🟡 [POST /api/bookings] Env vars WhatsApp:", {
    WHATSAPP_API_URL: process.env.WHATSAPP_API_URL || "(vacío)",
    WHATSAPP_INSTANCE_NAME: process.env.WHATSAPP_INSTANCE_NAME || "(vacío)",
    WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN
      ? `${process.env.WHATSAPP_API_TOKEN.slice(0, 3)}...${process.env.WHATSAPP_API_TOKEN.slice(-3)}`
      : "(vacío)",
  });

  if (
    !body.client_name ||
    !body.client_phone ||
    !body.service_id ||
    !body.service_option_id ||
    !body.start_time
  ) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios para crear la reserva" },
      { status: 400 }
    );
  }

  // 1) Guardar la cita en Supabase (teléfono normalizado a formato internacional 58412XXXXXXX)
  const normalizedPhone = sanitizePhoneNumber(body.client_phone);
  console.log("🟡 [POST /api/bookings] Teléfono normalizado para guardar/enviar:", {
    recibido: body.client_phone,
    normalizado: normalizedPhone,
  });

  const { data, error } = await admin
    .from("bookings")
    .insert({
      client_name: body.client_name.trim(),
      client_phone: normalizedPhone || body.client_phone.trim(),
      service_id: body.service_id,
      service_option_id: body.service_option_id,
      start_time: body.start_time,
      end_time: body.end_time ?? null,
      status: body.status ?? "confirmed",
    })
    .select()
    .single();

  if (error || !data) {
    console.error("❌ ERROR creando reserva:", error);
    return NextResponse.json(
      { error: "Error al guardar la reserva" },
      { status: 500 }
    );
  }

  console.log("✅ Reserva guardada correctamente (id:", data.id, ")");

  // 2) Enviar confirmación de WhatsApp (sin tumbar el flujo si falla)
  try {
    const serviceName = body.service_name || "tu servicio";
    const optionName = body.option_name;
    const displayName = optionName
      ? `${serviceName} (${optionName})`
      : serviceName;

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

  return NextResponse.json({ data });
}