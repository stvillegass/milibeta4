-- ================================================================
-- MILIBEAUTY - CONSOLIDATED DATABASE SETUP
-- Ejecutar esto en el SQL Editor de Supabase de UNA VEZ.
-- ================================================================
-- Incluye: schema.sql + update_schedules.sql + setup_rpc.sql
-- (update_bookings_calendar.sql es redundante: google_event_id
--  ya está incluido en schema.sql más abajo)
-- ================================================================

-- ==========================================
-- 0. EXTENSIÓN PARA UUIDs
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. GESTOR DE SERVICIOS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- Ej: 'nails', 'lashes'
    image_url TEXT,
    order_index INTEGER DEFAULT 0, -- Para ordenamiento drag & drop
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modalidades de Servicio (Clásico, Premium, etc.)
CREATE TABLE IF NOT EXISTS public.service_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. HORARIOS Y DISPONIBILIDAD
-- ==========================================

-- Horario semanal habitual (con slots individuales)
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_of_week INTEGER NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 1=Lunes, 6=Sábado
    is_active BOOLEAN DEFAULT TRUE,
    slots TEXT[] NOT NULL DEFAULT '{}', -- Array de horarios disponibles, ej: {'09:00','10:00','11:00'}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fechas bloqueadas (excepciones, días libres)
CREATE TABLE IF NOT EXISTS public.blocked_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. CITAS Y RESERVAS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    service_id UUID NOT NULL REFERENCES public.services(id),
    service_option_id UUID NOT NULL REFERENCES public.service_options(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    google_event_id TEXT, -- ID del evento de Google Calendar
    synced_to_calendar BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. POLÍTICAS DE SEGURIDAD (Row Level Security)
-- ==========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Políticas para Servicios (Público lee, Admin escribe)
DROP POLICY IF EXISTS "Servicios visibles para todos" ON public.services;
CREATE POLICY "Servicios visibles para todos" ON public.services FOR SELECT USING (true);

DROP POLICY IF EXISTS "Opciones visibles para todos" ON public.service_options;
CREATE POLICY "Opciones visibles para todos" ON public.service_options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gestiona servicios" ON public.services;
CREATE POLICY "Admin gestiona servicios" ON public.services USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin gestiona opciones" ON public.service_options;
CREATE POLICY "Admin gestiona opciones" ON public.service_options USING (auth.role() = 'authenticated');

-- Políticas para Horarios (Público lee, Admin escribe)
DROP POLICY IF EXISTS "Horarios visibles para todos" ON public.schedules;
CREATE POLICY "Horarios visibles para todos" ON public.schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Bloqueos visibles para todos" ON public.blocked_dates;
CREATE POLICY "Bloqueos visibles para todos" ON public.blocked_dates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gestiona horarios" ON public.schedules;
CREATE POLICY "Admin gestiona horarios" ON public.schedules USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin gestiona bloqueos" ON public.blocked_dates;
CREATE POLICY "Admin gestiona bloqueos" ON public.blocked_dates USING (auth.role() = 'authenticated');

-- Políticas para Reservas (Público crea, Admin lee y gestiona)
DROP POLICY IF EXISTS "Público puede crear reservas" ON public.bookings;
CREATE POLICY "Público puede crear reservas" ON public.bookings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin gestiona reservas" ON public.bookings;
CREATE POLICY "Admin gestiona reservas" ON public.bookings USING (auth.role() = 'authenticated');

-- ==========================================
-- 5. TRIGGERS PARA UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Limpiar triggers existentes para evitar duplicados
DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
DROP TRIGGER IF EXISTS update_schedules_updated_at ON public.schedules;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==========================================
-- 6. GRANTS EXPLÍCITOS (buena práctica)
-- ==========================================

-- Público (anon) y autenticados pueden SELECT en tablas de lectura pública
GRANT SELECT ON public.services TO anon, authenticated;
GRANT SELECT ON public.service_options TO anon, authenticated;
GRANT SELECT ON public.schedules TO anon, authenticated;
GRANT SELECT ON public.blocked_dates TO anon, authenticated;

-- Autenticados (admin) pueden INSERT/UPDATE/DELETE en tablas de gestión
GRANT ALL ON public.services TO authenticated;
GRANT ALL ON public.service_options TO authenticated;
GRANT ALL ON public.schedules TO authenticated;
GRANT ALL ON public.blocked_dates TO authenticated;

-- Público puede INSERT en bookings (para crear citas), admin todo
GRANT INSERT ON public.bookings TO anon;
GRANT ALL ON public.bookings TO authenticated;

-- Necesario para usar columnas serial/identity si existieran
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ==========================================
-- 7. FUNCIÓN RPC: get_occupied_slots()
-- ==========================================
-- Obtiene slots ocupados sin exponer datos de clientes.
-- ⚠️ IMPORTANTE: Se usa 'America/Caracas' como zona horaria.
--    (Ajusta este valor si tu negocio opera en otra zona.)

CREATE OR REPLACE FUNCTION get_occupied_slots()
RETURNS TABLE(date TEXT, time TEXT) AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    to_char(start_time AT TIME ZONE 'America/Caracas', 'YYYY-MM-DD') AS date,
    to_char(start_time AT TIME ZONE 'America/Caracas', 'HH24:MI') AS time
  FROM public.bookings 
  WHERE status IN ('confirmed', 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos a usuarios públicos y autenticados para ejecutar esta función
GRANT EXECUTE ON FUNCTION get_occupied_slots() TO public;
GRANT EXECUTE ON FUNCTION get_occupied_slots() TO authenticated;
GRANT EXECUTE ON FUNCTION get_occupied_slots() TO anon;

-- ==========================================
-- 8. DATOS INICIALES OPCIONALES (Descomenta si quieres precargar)
-- ==========================================

-- INSERT INTO public.schedules (day_of_week, is_active, slots) VALUES
--   (1, true, ARRAY['09:00','10:00','11:00','12:00','13:00','16:00','17:00']),
--   (2, true, ARRAY['09:00','10:00','11:00','12:00','13:00','16:00','17:00']),
--   (3, true, ARRAY['09:00','10:00','11:00','12:00','13:00','16:00','17:00']),
--   (4, true, ARRAY['09:00','10:00','11:00','12:00','13:00','16:00','17:00']),
--   (5, true, ARRAY['09:00','10:00','11:00','12:00','13:00','16:00','17:00']),
--   (6, true, ARRAY['09:00','10:00','11:00','12:00','13:00','16:00']),
--   (0, false, ARRAY[]::TEXT[]);

-- INSERT INTO public.services (name, description, category, image_url, order_index) VALUES
--   ('Semipermanente', 'Esmaltado de larga duración con acabado profesional.', 'nails',
--    'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop', 1),
--   ('Esculpidas Acrílicas', 'Extensiones resistentes y elegantes moldeadas a la perfección.', 'nails',
--    'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?q=80&w=1000&auto=format&fit=crop', 2),
--   ('Lifting de Pestañas', 'Realza tu mirada con un efecto natural y duradero.', 'lashes',
--    'https://images.unsplash.com/photo-1588661609100-3490b6cba2d3?q=80&w=1000&auto=format&fit=crop', 1);

-- ================================================================
-- FIN DEL SCRIPT CONSOLIDADO
-- Ejecuta todo de una sola vez. Verifica que no haya errores.
-- ================================================================