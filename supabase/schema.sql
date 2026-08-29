-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. GESTOR DE SERVICIOS
-- ==========================================

CREATE TABLE public.services (
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
CREATE TABLE public.service_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    description TEXT, -- Descripción individual de qué incluye cada modalidad
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. HORARIOS Y DISPONIBILIDAD
-- ==========================================

-- Horario semanal habitual
CREATE TABLE public.schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_of_week INTEGER NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 1=Lunes, 6=Sábado
    is_active BOOLEAN DEFAULT TRUE,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fechas bloqueadas (excepciones, días libres)
CREATE TABLE public.blocked_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. CITAS Y RESERVAS
-- ==========================================

CREATE TABLE public.bookings (
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
CREATE POLICY "Servicios visibles para todos" ON public.services FOR SELECT USING (true);
CREATE POLICY "Opciones visibles para todos" ON public.service_options FOR SELECT USING (true);
CREATE POLICY "Admin gestiona servicios" ON public.services USING (auth.role() = 'authenticated');
CREATE POLICY "Admin gestiona opciones" ON public.service_options USING (auth.role() = 'authenticated');

-- Políticas para Horarios (Público lee, Admin escribe)
CREATE POLICY "Horarios visibles para todos" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "Bloqueos visibles para todos" ON public.blocked_dates FOR SELECT USING (true);
CREATE POLICY "Admin gestiona horarios" ON public.schedules USING (auth.role() = 'authenticated');
CREATE POLICY "Admin gestiona bloqueos" ON public.blocked_dates USING (auth.role() = 'authenticated');

-- Políticas para Reservas (Público crea, Admin lee y gestiona)
CREATE POLICY "Público puede crear reservas" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin gestiona reservas" ON public.bookings USING (auth.role() = 'authenticated');
-- OJO: No hay política pública de SELECT en bookings por privacidad.

-- ==========================================
-- 5. TRIGGERS PARA UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
