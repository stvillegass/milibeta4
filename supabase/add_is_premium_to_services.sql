-- ==========================================
-- AGREGAR COLUMNA is_premium A LA TABLA services
-- ==========================================
-- Ejecutar en el SQL Editor de Supabase.
-- Permite filtrar a nivel de consulta qué servicios son visibles
-- cuando el modo premium está desactivado.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;

-- Por defecto todos los servicios existentes son NO premium (visibles siempre).
-- Si algún servicio debe ser exclusivo del modo premium,
-- actualízalo manualmente:
--   UPDATE public.services SET is_premium = true WHERE name ILIKE '%premium%';

-- Verificar el resultado:
SELECT id, name, category, is_premium FROM public.services ORDER BY order_index;
