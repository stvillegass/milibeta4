-- LOOKBOOK ITEMS: tabla + RLS
CREATE TABLE IF NOT EXISTS public.lookbook_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'nails',
    image_url TEXT NOT NULL,
    likes_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lookbook_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lookbook_select" ON public.lookbook_items;
CREATE POLICY "lookbook_select" ON public.lookbook_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "lookbook_admin" ON public.lookbook_items;
CREATE POLICY "lookbook_admin" ON public.lookbook_items FOR ALL USING (auth.role() = 'authenticated');

GRANT SELECT ON public.lookbook_items TO anon;
GRANT SELECT ON public.lookbook_items TO authenticated;
GRANT ALL ON public.lookbook_items TO authenticated;