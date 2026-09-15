-- ================================================================
-- MILIBEAUTY - SERVICIOS COMBINADOS EN RESERVAS
-- Añade la columna opcional `combo_services` (JSONB) a public.bookings
-- para persistir los servicios adicionales (Manicure + Pedicure + Cejas)
-- que se reservan junto al servicio principal.
--
-- Ejecutar en el SQL Editor de Supabase (idempotente).
-- ================================================================

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS combo_services JSONB DEFAULT '[]'::jsonb;

-- Documentación de la estructura almacenada:
-- [
--   {
--     "service_id": "uuid-o-null",
--     "service_name": "Pedicure",
--     "option_name": "Spa",
--     "price": 30,
--     "duration_minutes": 60
--   }
-- ]
COMMENT ON COLUMN public.bookings.combo_services IS
    'Servicios adicionales combinados con el principal: [{service_id, service_name, option_name, price, duration_minutes}]';

-- Índice GIN opcional para consultas por contenido JSONB
CREATE INDEX IF NOT EXISTS idx_bookings_combo_services
    ON public.bookings USING GIN (combo_services);

-- Refresca la caché de esquema de PostgREST para que la nueva
-- columna esté disponible de inmediato en la API de Supabase.
NOTIFY pgrst, 'reload schema';