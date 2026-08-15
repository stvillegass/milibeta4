import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const scope = ["https://www.googleapis.com/auth/calendar.events"];

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  const missing: string[] = [];
  if (!clientEmail) missing.push("GOOGLE_CLIENT_EMAIL");
  if (!rawPrivateKey) missing.push("GOOGLE_PRIVATE_KEY");
  if (!calendarId) missing.push("GOOGLE_CALENDAR_ID");

  if (missing.length > 0) {
    throw new Error(`Google Calendar credentials not configured. Missing: ${missing.join(", ")}`);
  }

  const privateKey = rawPrivateKey!.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail!,
    key: privateKey,
    scopes: scope,
  });
  return { auth, calendarId: calendarId! };
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface CalendarEventData {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
}

export async function listCalendarEvents(timeMin?: string, maxResults = 100): Promise<any[]> {
  const { auth, calendarId } = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.list({
    calendarId,
    timeMin: timeMin || new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });
  return res.data.items || [];
}

export async function createCalendarEvent(data: CalendarEventData): Promise<string> {
  const { auth, calendarId } = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: data.summary,
      description: data.description,
      start: { dateTime: data.startTime },
      end: { dateTime: data.endTime },
    },
  });
  const eventId = res.data.id;
  if (!eventId) throw new Error("Google Calendar returned no event id.");
  return eventId;
}

export async function updateCalendarEvent(eventId: string, data: CalendarEventData): Promise<void> {
  const { auth, calendarId } = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.update({
    calendarId,
    eventId,
    requestBody: {
      summary: data.summary,
      description: data.description,
      start: { dateTime: data.startTime },
      end: { dateTime: data.endTime },
    },
  });
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const { auth, calendarId } = getAuth();
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({ calendarId, eventId });
}

export async function saveGoogleEventId(bookingId: string, eventId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  const { error } = await admin
    .from("bookings")
    .update({ google_event_id: eventId, synced_to_calendar: true })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function markBookingCancelled(bookingId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  const { error } = await admin
    .from("bookings")
    .update({ status: "cancelled", synced_to_calendar: false })
    .eq("id", bookingId);
  if (error) throw error;
}

export async function getBookingGoogleEventId(bookingId: string): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("bookings")
    .select("google_event_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !data?.google_event_id) return null;
  return data.google_event_id as string;
}