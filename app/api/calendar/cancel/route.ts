import { NextResponse } from "next/server";
import { deleteCalendarEvent, getBookingGoogleEventId, markBookingCancelled } from "@/lib/googleCalendar";

export async function POST(request: Request) {
  try {
    const { bookingId } = await request.json();
    if (!bookingId) {
      return NextResponse.json({ error: "bookingId es requerido" }, { status: 400 });
    }

    const eventId = await getBookingGoogleEventId(bookingId);

    if (eventId && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CALENDAR_ID) {
      try {
        await deleteCalendarEvent(eventId);
      } catch (err: any) {
        console.warn("No se pudo eliminar el evento de Google (puede ya no existir):", err.message);
      }
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await markBookingCancelled(bookingId);
    }

    return NextResponse.json({ success: true, googleEventId: eventId || null });
  } catch (error: any) {
    console.error("Google Calendar Cancel Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}