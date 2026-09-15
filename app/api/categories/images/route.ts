import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  CACHE_TAGS,
  NO_STORE_HEADERS,
  getCachedCategoryImages,
  revalidateAppCache,
} from "@/lib/appCache";

const DEFAULT_IMAGES: { nails: string; lashes: string } = {
  nails: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop",
  lashes: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1000&auto=format&fit=crop",
};

function jsonWithNoCache(data: unknown) {
  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...NO_STORE_HEADERS },
  });
}

/** Normaliza lo almacenado en `app_settings.category_images`. */
function normalizeImages(value: unknown): { nails: string; lashes: string } {
  const val = (value ?? {}) as Record<string, unknown>;
  return {
    nails: typeof val.nails === "string" && val.nails ? val.nails : DEFAULT_IMAGES.nails,
    lashes: typeof val.lashes === "string" && val.lashes ? val.lashes : DEFAULT_IMAGES.lashes,
  };
}

/**
 * GET — portadas de las categorías.
 *
 * La lectura va por `unstable_cache` (tag `category-images`): no se golpea
 * Supabase en cada visita y el panel invalida el tag al guardar, por lo que el
 * cambio se refleja de inmediato. La respuesta siempre va con `no-store` para
 * que el navegador nunca sirva una portada vieja.
 */
export async function GET() {
  let images = { ...DEFAULT_IMAGES };
  try {
    const stored = await getCachedCategoryImages();
    images = normalizeImages(stored);
  } catch (e) {
    console.error("[categories/images] Error al leer de Supabase:", e);
  }

  // app_settings no tiene updated_at: marca local como cache-buster
  return jsonWithNoCache({ ...images, updatedAt: Date.now() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const current = normalizeImages(await getCachedCategoryImages());
    const images = {
      nails:
        typeof body?.nails === "string" && body.nails ? String(body.nails) : current.nails,
      lashes:
        typeof body?.lashes === "string" && body.lashes ? String(body.lashes) : current.lashes,
    };

    // Persistir en Supabase (fuente única de verdad) para que no se pierda en
    // cada cold start o instancia serverless y se refleje de inmediato en la portada.
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "category_images", value: images }, { onConflict: "key" });
    if (error) {
      console.error("[categories/images] No se pudo persistir en Supabase:", error.message);
      return new NextResponse(
        JSON.stringify({ error: "No se pudo guardar la portada" }),
        { status: 500, headers: { "Content-Type": "application/json", ...NO_STORE_HEADERS } }
      );
    }

    // Invalidar el tag: la vista pública toma las nuevas portadas al instante
    revalidateAppCache([CACHE_TAGS.categoryImages, CACHE_TAGS.siteConfig]);

    return jsonWithNoCache({ ...images, updatedAt: Date.now() });
  } catch (e) {
    console.error("[categories/images] Error en POST:", e);
    return jsonWithNoCache({ ...DEFAULT_IMAGES, updatedAt: Date.now() });
  }
}