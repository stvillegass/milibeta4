-- ==========================================
-- HABILITAR SUPABASE REALTIME EN app_settings
-- ==========================================
-- Ejecutar este script en el SQL Editor de Supabase.
-- Esto es OBLIGATORIO para que el canal postgres_changes del
-- ReservationModal reciba actualizaciones en tiempo real del toggle.

-- 1. Agregar la tabla app_settings a la publicación de Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- 2. (Opcional) Verificar qué tablas están publicadas
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- ==========================================
-- CONSOLIDAR CLAVES PREMIUM (limpieza)
-- ==========================================
-- Si existe la clave fantasma 'premium_services_enabled',
-- eliminarla para evitar confusión. Solo se usa 'premium_enabled'.

DELETE FROM public.app_settings
WHERE key = 'premium_services_enabled';

-- Confirmar que solo queda la clave canónica
SELECT key, value FROM public.app_settings WHERE key LIKE 'premium%';
