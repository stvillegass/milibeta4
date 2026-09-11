import { NextResponse } from "next/server";
import {
  sendWhatsAppConfirmation,
  sendWhatsAppReminder,
} from "@/lib/whatsapp";

/**
 * ENDPOINT TEMPORAL DE PRUEBA — NO desplegar en producción.
 *
 * Permite disparar una prueba piloto de los mensajes de WhatsApp
 * (confirmación de cita y recordatorio de retoque) contra la Evolution API.
 *
 * Uso:
 *   GET /api/test/whatsapp?phone=584XXXXXXXXX&type=both|confirmation|reminder
 *
 * Autenticación: requiere header `Authorization: Bearer <CRON_SECRET>`
 * (misma protección que el cron de recordatorios).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // 1) Auth con el mismo secreto del cron (por si acaso se despliega en remoto)
  const authHeader = request.headers.get("authorization");
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2) Parámetros
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone") || "";
  const type = searchParams.get("type") || "both"; // both | confirmation | reminder

  if (!phone) {
    return NextResponse.json(
      { error: "Falta el parámetro ?phone= (ej: 584XXXXXXXXX)" },
      { status: 400 }
    );
  }

  const clientName = "Cliente Prueba Piloto";
  const serviceName = "Semipermanente (Clásico)";
  const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const results: any = {};

  if (type === "confirmation" || type === "both") {
    results.confirmation = await sendWhatsAppConfirmation(
      phone,
      clientName,
      serviceName,
      { startTime }
    );
  }

  if (type === "reminder" || type === "both") {
    results.reminder = await sendWhatsAppReminder(
      phone,
      clientName,
      serviceName,
      startTime
    );
  }

  return NextResponse.json({ success: true, results, phone });
}