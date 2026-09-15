import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ALL_CACHE_TAGS, NO_STORE_HEADERS, revalidateAppCache } from "@/lib/appCache";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * POST /api/revalidate — invalida al instante el caché de configuración/catálogos.
 *
 * Requiere sesión de administrador válida (Bearer token de Supabase). El panel
 * lo llama justo después de guardar cambios para que la vista pública se
 * actualice de inmediato.
 *
 * Body: { tags?: string[] }  — sin body se invalidan TODOS los tags conocidos.
 */
export async function POST(request: Request) {
  try {
    // Rate limiting: evita que alguien automatice invalidaciones de caché
    const { ok, retryAfterSec } = rateLimit(`revalidate:${getClientIp(request)}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." },
        { status: 429, headers: { ...NO_STORE_HEADERS, "Retry-After": String(retryAfterSec) } }
      );
    }

    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "No token provided" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase no configurado" },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sesión de administrador no válida o expirada" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    let requested: string[] = ALL_CACHE_TAGS;
    try {
      const body = await request.json();
      if (Array.isArray(body?.tags) && body.tags.length > 0) {
        requested = body.tags.filter((t: unknown): t is string => typeof t === "string");
      }
    } catch {
      // Sin body válido: se invalidan todos los tags conocidos
    }

    const revalidated = revalidateAppCache(requested);
    return NextResponse.json(
      { revalidated, at: Date.now() },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: any) {
    console.error("[revalidate] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al invalidar caché" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}