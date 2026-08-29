import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppReminder } from "@/lib/whatsapp";

/**
 * Configuración del runtime de Node.js (necesario para el cliente Supabase).
 */
export const runtime = "nodejs";

/**
 * Tipo de una cita con los datos necesarios para el recordatorio.
 */
interface BookingWithService {
  id: string;
  client_name: string;
  client_phone: string;
  start_time: string;
  services: {
    name: string;
    reminder_days: number | null;
  }[];
}

/**
 * Endpoint GET ejecutado por Vercel Cron.
 *
 * Autenticación: requiere el encabezado `Authorization: Bearer <CRON_SECRET>`.
 * Proceso:
 *  1. Verifica el CRON_SECRET.
 *  2. Consulta citas completadas sin recordatorio enviado.
 *  3. Para cada cita, evalúa si ya pasó el tiempo de retoque.
 *  4. Envía el recordatorio por WhatsApp y marca `reminder_sent = true`.
 */
export async function GET(request: Request) {
  // 1. Autenticación del cron
  const authHeader = request.headers.get("authorization");
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedToken) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2. Cliente Supabase con rol de servicio (omite RLS)
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 3. Consulta de citas completadas sin recordatorio enviado
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        "id, client_name, client_phone, start_time, services ( name, reminder_days )"
      )
      .eq("status", "completed")
      .eq("reminder_sent", false);

    if (error) {
      console.error("❌ ERROR consultando bookings:", error);
      return NextResponse.json(
        { error: "Error consultando bookings" },
        { status: 500 }
      );
    }

    const now = new Date();
    const sentIds: string[] = [];

    // 4. Evaluación y envío de recordatorios
    for (const booking of (bookings ?? []) as BookingWithService[]) {
      const service = booking.services?.[0];
      const serviceName = service?.name ?? "tu servicio";
      const reminderDays = service?.reminder_days ?? 21;

      // Fecha objetivo = fecha de la cita + días de retoque
      const appointmentDate = new Date(booking.start_time);
      const targetDate = new Date(appointmentDate);
      targetDate.setDate(targetDate.getDate() + reminderDays);

      // Si la fecha actual es mayor o igual a la fecha objetivo, enviar recordatorio
      if (now >= targetDate) {
        const sent = await sendWhatsAppReminder(
          booking.client_phone,
          booking.client_name,
          serviceName,
          booking.start_time,
          supabase
        );

        if (sent) {
          sentIds.push(booking.id);
        }
      }
    }

    // 5. Marcar como enviados los recordatorios procesados
    if (sentIds.length > 0) {
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ reminder_sent: true })
        .in("id", sentIds);

      if (updateError) {
        console.error("❌ ERROR actualizando reminder_sent:", updateError);
        return NextResponse.json(
          { error: "Error actualizando reminder_sent" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, processed: sentIds.length });
  } catch (error) {
    console.error("❌ ERROR en el cron de recordatorios:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}