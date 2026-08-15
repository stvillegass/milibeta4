-- Añadir columna para almacenar el ID del evento de Google Calendar
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS google_event_id TEXT;
