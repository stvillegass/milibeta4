import { NextResponse } from "next/server";
import {
  CACHE_TAGS,
  NO_STORE_HEADERS,
  getCachedServicesCatalog,
} from "@/lib/appCache";

export const dynamic = "force-dynamic";

/**
 * GET — catálogo público de servicios con sus modalidades.
 *
 * Es un catálogo prácticamente estático: se sirve desde la caché de datos de
 * Next (tag `services-catalog`) para no golpear Supabase en cada visita, y el
 * panel de administración invalida el tag al guardar/eliminar/reordenar, con lo
 * que la vista pública se actualiza de inmediato.
 */
export async function GET() {
  try {
    const services = await getCachedServicesCatalog();
    return NextResponse.json(
      { services, tag: CACHE_TAGS.servicesCatalog },
      { headers: NO_STORE_HEADERS }
    );
  } catch (e) {
    console.error("[services] Error al leer el catálogo:", e);
    return NextResponse.json(
      { services: [] },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  }
}