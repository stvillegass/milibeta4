-- ==========================================
-- TABLA app_settings PARA CONFIGURACIÓN GLOBAL
-- ==========================================
-- Almacena pares clave-valor para configuraciones del sistema
-- (ej: premium_enabled, site_config con Pago Móvil, etc.) con persistencia real en Supabase.

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Políticas: Público puede leer, Admin (autenticado) y Anon pueden gestionar
DROP POLICY IF EXISTS "Configuración visible para todos" ON public.app_settings;
CREATE POLICY "Configuración visible para todos" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gestiona configuración" ON public.app_settings;
CREATE POLICY "Admin gestiona configuración" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated, service_role;

-- Trigger para actualizar updated_at (si la función existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
        CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- Valores iniciales por defecto
INSERT INTO public.app_settings (key, value)
VALUES 
    ('premium_enabled', 'true'::jsonb),
    ('site_config', '{
        "studioName": "Milibeauty",
        "studioSubtitle": "Estudio de lujo especializado en el cuidado y diseño de tus manos y mirada.",
        "studioAddress": "Av. Principal Las Mercedes, Edificio Centro Empresarial, Piso 3, Local 302",
        "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Milibeauty+Studio",
        "bankName": "Banesco (0134)",
        "bankId": "V-26123456",
        "bankPhone": "0412-1234567",
        "bankOwner": "Milibeauty C.A.",
        "premiumEnabled": true,
        "whatsappReminderTemplate": "¡Hola {nombre}! ✨ Se acerca el tiempo ideal para el retoque de tu servicio de {servicio}. Tu cita fue el {fecha} a las {hora}. ¿Te gustaría agendar tu cita para esta semana?",
        "whatsappConfirmationTemplate": "¡Hola {nombre}! 🌸 Tu cita en Milibeauty quedó confirmada: {servicio} el {fecha} a las {hora}. ¡Te esperamos! 💅✨"
    }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Actualizar instalaciones existentes: añadir la plantilla de confirmación solo si no está definida
-- (no pisa personalizaciones que la admin ya haya guardado).
UPDATE public.app_settings
SET value = value || '{"whatsappConfirmationTemplate": "¡Hola {nombre}! 🌸 Tu cita en Milibeauty quedó confirmada: {servicio} el {fecha} a las {hora}. ¡Te esperamos! 💅✨"}'::jsonb
WHERE key = 'site_config'
  AND NOT (value ? 'whatsappConfirmationTemplate');