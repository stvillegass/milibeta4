import { NextResponse } from "next/server";
import { createCalendarEvent, saveGoogleEventId } from "@/lib/googleCalendar";

export async function POST(request: Request) {
  try {
    const { bookingId, clientName, serviceName, optionName, startTime, endTime } = await request.json();

    if (!bookingId || !startTime || !endTime) {
      return NextResponse.json({ error: "Missing required booking details" }, { status: 400 });
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    const missing: string[] = [];
    if (!clientEmail) missing.push("GOOGLE_CLIENT_EMAIL");
    if (!rawPrivateKey) missing.push("GOOGLE_PRIVATE_KEY");
    if (!calendarId) missing.push("GOOGLE_CALENDAR_ID");

    if (missing.length > 0) {
      console.warn(`Google Calendar credentials missing (${missing.join(", ")}). Skipping sync.`);
      return NextResponse.json({ message: "Skipped (no credentials)", missing });
    }

    const eventId = await createCalendarEvent({
      summary: `Reserva: ${clientName} - ${serviceName}`,
      description: `Servicio: ${serviceName} (${optionName})\nCliente: ${clientName}`,
      startTime,
      endTime,
    });

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await saveGoogleEventId(bookingId, eventId);
    }

    return NextResponse.json({ success: true, eventId, synced: true });
  } catch (error: any) {
    console.error("Google Calendar Sync Error:", error);
    return NextResponse.json({ error: error.message, synced: false }, { status: 500 });
  }
}