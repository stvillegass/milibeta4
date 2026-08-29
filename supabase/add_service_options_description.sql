-- ==========================================
-- ADMIN: STORAGE + DESC OPCIONES DE SERVICIO
-- ==========================================
-- Ejecutar este script en el SQL Editor del panel de Supabase.
-- Permite:
--   1) Agregar la columna "description" a service_options
--      (descripción individual de cada modalidad: Clásico, Premium, etc.)
--   2) Asegurar el bucket de Storage "lookbook-images" como PÚBLICO
--      con políticas que permitan al rol "authenticated" (admin)
--      subir (INSERT), actualizar (UPDATE) y eliminar (DELETE) imágenes.

-- 1) Columna description en service_options
ALTER TABLE public.service_options
    ADD COLUMN IF NOT EXISTS description TEXT;

-- 2) Bucket de Storage "lookbook-images" (idéntico a create_lookbook_bucket.sql)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lookbook-images',
  'lookbook-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

-- 3) Políticas de Storage
-- Lectura pública (SELECT) para todos
DROP POLICY IF EXISTS "lookbook_images_select_public" ON storage.objects;
CREATE POLICY "lookbook_images_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lookbook-images');

-- Insert solo usuarios autenticados (admin sube portadas/imágenes)
DROP POLICY IF EXISTS "lookbook_images_insert_authenticated" ON storage.objects;
CREATE POLICY "lookbook_images_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lookbook-images'
    AND auth.role() = 'authenticated'
  );

-- Update solo usuarios autenticados
DROP POLICY IF EXISTS "lookbook_images_update_authenticated" ON storage.objects;
CREATE POLICY "lookbook_images_update_authenticated"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'lookbook-images' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'lookbook-images' AND auth.role() = 'authenticated');

-- Delete solo usuarios autenticados (admin elimina imágenes)
DROP POLICY IF EXISTS "lookbook_images_delete_authenticated" ON storage.objects;
CREATE POLICY "lookbook_images_delete_authenticated"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lookbook-images'
    AND auth.role() = 'authenticated'
  );

-- Verificación
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'lookbook-images';
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'service_options' ORDER BY ordinal_position;
