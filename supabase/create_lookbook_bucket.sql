-- ==========================================
-- CREAR BUCKET "lookbook-images" EN SUPABASE STORAGE
-- ==========================================
-- Ejecutar este script en el SQL Editor del panel de Supabase.
-- Crea el bucket como PÚBLICO y añade las políticas de acceso necesarias.

-- 1. Crear el bucket (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lookbook-images',
  'lookbook-images',
  true,                           -- Público: las URLs son accesibles sin autenticación
  5242880,                        -- Límite: 5 MB por imagen
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

-- 2. Política: lectura pública (SELECT) para todos
DROP POLICY IF EXISTS "lookbook_images_select_public" ON storage.objects;
CREATE POLICY "lookbook_images_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lookbook-images');

-- 3. Política: INSERT solo para usuarios autenticados (admins)
DROP POLICY IF EXISTS "lookbook_images_insert_authenticated" ON storage.objects;
CREATE POLICY "lookbook_images_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lookbook-images'
    AND auth.role() = 'authenticated'
  );

-- 4. Política: DELETE solo para usuarios autenticados (admins)
DROP POLICY IF EXISTS "lookbook_images_delete_authenticated" ON storage.objects;
CREATE POLICY "lookbook_images_delete_authenticated"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lookbook-images'
    AND auth.role() = 'authenticated'
  );

-- Verificación: debe mostrar el bucket recién creado
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'lookbook-images';
