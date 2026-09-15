import { NextResponse } from "next/server";
import { NO_STORE_HEADERS, getCachedServicesCatalog } from "@/lib/appCache";

export const runtime = "nodejs";

/**
 * GET /api/catalog — catálogo público de servicios.
 *
 * Lectura cacheada con tag `services-catalog` (revalidación de respaldo cada 5 min).
 * El panel de administración invalida el tag al guardar/eliminar/reordenar servicios,
 * por lo que este endpoint refleja los cambios de inmediato sin golpear Supabase
 * en cada visita.
 *
 * Respuesta siempre `no-store` hacia el navegador para evitar datos obsoletos.
 */
export async function GET() {
  try {
    const services = await getCachedServicesCatalog();
    return NextResponse.json({ services, updatedAt: Date.now() }, { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error("[catalog] Error leyendo catálogo:", e);
    return NextResponse.json(
      { services: [], updatedAt: Date.now() },
      { headers: NO_STORE_HEADERS }
    );
  }
}