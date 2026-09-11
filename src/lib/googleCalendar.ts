import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const scope = ['https://www.googleapis.com/auth/calendar.events'];

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  // Validación explícita de credenciales
  const missing: string[] = [];
  if (!clientEmail) missing.push('GOOGLE_CLIENT_EMAIL');
  if (!rawPrivateKey) missing.push('GOOGLE_PRIVATE_KEY');
  if (!calendarId) missing.push('GOOGLE_CALENDAR_ID');

  if (missing.length > 0) {
    throw new Error(
      `Google Calendar credentials not configured. Missing: ${missing.join(', ')}`
    );
  }

  // Normalizar la clave privada: reemplaza \n literales por saltos de línea reales
  const privateKey = rawPrivateKey!.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail!,
    key: privateKey,
    scopes: scope,
  });
  return { auth, calendarId: calendarId! };
}

function getAdminClient() {
  const url = process.env.VITE_SUPABASE_URL;
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
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId,
    timeMin: timeMin || new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data.items || [];
}

export async function createCalendarEvent(data: CalendarEventData): Promise<string> {
  const { auth, calendarId } = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
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
  if (!eventId) throw new Error('Google Calendar returned no event id.');
  return eventId;
}

export async function updateCalendarEvent(eventId: string, data: CalendarEventData): Promise<void> {
  const { auth, calendarId } = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
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
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({ calendarId, eventId });
}

export async function saveGoogleEventId(bookingId: string, eventId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  const { error } = await admin
    .from('bookings')
    .update({ google_event_id: eventId, synced_to_calendar: true })
    .eq('id', bookingId);
  if (error) throw error;
}

export async function markBookingCancelled(bookingId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  const { error } = await admin
    .from('bookings')
    .update({ status: 'cancelled', synced_to_calendar: false })
    .eq('id', bookingId);
  if (error) throw error;
}

export interface BusySlot {
  start: string;
  end: string;
}

/**
 * Devuelve los rangos horarios ocupados en Google Calendar para una fecha dada.
 * La fecha debe tener formato 'YYYY-MM-DD'. Los rangos se devuelven como objetos
 * con `start` y `end` en formato ISO 8601.
 */
export async function getBusySlotsForDate(date: string): Promise<BusySlot[]> {
  const [year, month, day] = date.split('-').map(Number);
  // Límites del día en hora local (UTC para no depender de la zona horaria del server)
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  const events = await listCalendarEvents(dayStart.toISOString(), 250);

  const busySlots: BusySlot[] = [];

  for (const event of events) {
    const startRaw = event?.start?.dateTime || event?.start?.date;
    const endRaw = event?.end?.dateTime || event?.end?.date;
    if (!startRaw || !endRaw) continue;

    let startTime = new Date(startRaw).getTime();
    let endTime = new Date(endRaw).getTime();

    // Los eventos de día completo (sin dateTime) tienen fin exclusivo; restamos 1ms
    // para que el rango sea [inicio, fin] inclusivo y no roce el día siguiente.
    if (!event?.start?.dateTime) {
      endTime = endTime - 1;
    }

    // Solamente considerar eventos que se solapan con el día solicitado
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();
    if (endTime <= dayStartMs || startTime >= dayEndMs) continue;

    const start = new Date(Math.max(startTime, dayStartMs));
    const end = new Date(Math.min(endTime, dayEndMs));

    if (end.getTime() > start.getTime()) {
      busySlots.push({ start: start.toISOString(), end: end.toISOString() });
    }
  }

  // Ordenar cronológicamente
  busySlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return busySlots;
}

export async function getBookingGoogleEventId(bookingId: string): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from('bookings')
    .select('google_event_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !data?.google_event_id) return null;
  return data.google_event_id as string;
}