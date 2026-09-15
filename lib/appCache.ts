import { unstable_cache, revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";

/**
 * Caché inteligente para configuraciones y catálogos estáticos.
 *
 * Estrategia:
 *  1. Las lecturas a Supabase se guardan en la caché de datos de Next con
 *     TAGS específicos y una revalidación temporal de respaldo (5 min).
 *  2. Cuando el panel de administrador guarda algo, la ruta POST correspondiente
 *     llama a `revalidateAppCache([...])` y el tag se invalida al instante, por
 *     lo que la siguiente lectura pública ya trae el valor nuevo.
 *  3. Las RESERVAS nunca se cachean (`no-store`) porque son datos vivos.
 */

export const CACHE_TAGS = {
  siteConfig: "site-config",
  premiumEnabled: "premium-enabled",
  categoryImages: "category-images",
  servicesCatalog: "services-catalog",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/** Lista blanca de tags válidos (evita invalidaciones arbitrarias). */
export const ALL_CACHE_TAGS: string[] = Object.values(CACHE_TAGS);

/** Tiempo de revalidación de respaldo (segundos) para datos de configuración. */
export const CACHE_TTL_SECONDS = 300;

/** Cabeceras para respuestas con datos vivos: nunca cacheadas en el navegador. */
export const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export type AppSettingRow = { key: string; value: unknown };

/** Lee una clave de `app_settings` y devuelve su valor (o null). */
async function readAppSetting(key: string): Promise<unknown> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) return null;
  return data.value ?? null;
}

/** `site_config`: textos, dirección, datos bancarios, plantillas de WhatsApp. */
export const getCachedSiteConfig = unstable_cache(
  () => readAppSetting("site_config"),
  ["app-setting-site-config"],
  { revalidate: CACHE_TTL_SECONDS, tags: [CACHE_TAGS.siteConfig] }
);

/** `premium_enabled`: interruptor de la modalidad Premium. */
export const getCachedPremiumEnabled = unstable_cache(
  () => readAppSetting("premium_enabled"),
  ["app-setting-premium-enabled"],
  { revalidate: CACHE_TTL_SECONDS, tags: [CACHE_TAGS.premiumEnabled] }
);

/** `category_images`: portadas de las categorías (nails / lashes). */
export const getCachedCategoryImages = unstable_cache(
  () => readAppSetting("category_images"),
  ["app-setting-category-images"],
  { revalidate: CACHE_TTL_SECONDS, tags: [CACHE_TAGS.categoryImages] }
);

export type CatalogOption = {
  id: string;
  name: string;
  price: number;
  duration: string;
  isPremium: boolean;
  description: string;
};

export type CatalogService = {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl: string | null;
  order: number;
  isPremium: boolean;
  options: CatalogOption[];
};

/**
 * Catálogo de servicios con sus modalidades. Es prácticamente estático, así que
 * se cachea con tag `services-catalog` y se invalida al guardar/eliminar/reordenar
 * servicios en el panel de administración.
 */
export const getCachedServicesCatalog = unstable_cache(
  async (): Promise<CatalogService[]> => {
    const { data, error } = await supabase
      .from("services")
      .select("*, service_options(*)")
      .order("order_index", { ascending: true });

    if (error || !data) return [];

    return data.map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description ?? "",
      imageUrl: s.image_url ?? null,
      order: s.order_index ?? 0,
      isPremium: Boolean(s.is_premium),
      options: (s.service_options || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        price: Number(o.price) || 0,
        duration: o.duration_minutes ? `${o.duration_minutes} min` : "60 min",
        isPremium: String(o.name || "").toLowerCase().includes("premium"),
        description: o.description ?? "",
      })),
    }));
  },
  ["services-catalog-v1"],
  { revalidate: CACHE_TTL_SECONDS, tags: [CACHE_TAGS.servicesCatalog] }
);

/**
 * Invalida al instante los tags indicados (solo se aceptan tags de la lista blanca).
 * Devuelve los tags realmente invalidados.
 */
export function revalidateAppCache(tags: string[]): string[] {
  const valid = tags.filter((tag) => ALL_CACHE_TAGS.includes(tag));
  for (const tag of valid) revalidateTag(tag);
  return valid;
}