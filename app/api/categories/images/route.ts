import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Deshabilitar caché de Next.js: cada lectura trae el estado real de Supabase
export const dynamic = "force-dynamic";

const DEFAULT_IMAGES: { nails: string; lashes: string } = {
  nails: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop",
  lashes: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1000&auto=format&fit=crop",
};

// Caché en memoria solo como acelerador; la fuente de verdad es Supabase
let memory: { nails: string; lashes: string; updatedAt: number } = {
  nails: DEFAULT_IMAGES.nails,
  lashes: DEFAULT_IMAGES.lashes,
  updatedAt: 0,
};

function jsonWithNoCache(data: unknown) {
  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "category_images")
      .maybeSingle();

    if (!error && data) {
      const val = (data.value ?? {}) as Record<string, unknown>;
      memory = {
        nails: typeof val.nails === "string" && val.nails ? val.nails : DEFAULT_IMAGES.nails,
        lashes: typeof val.lashes === "string" && val.lashes ? val.lashes : DEFAULT_IMAGES.lashes,
        // app_settings no tiene updated_at: usamos una marca local como cache-buster
        updatedAt: Date.now(),
      };
    } else {
      // No hay registro todavía: devolver los valores por defecto configurados
      memory = { ...DEFAULT_IMAGES, updatedAt: 0 };
    }
  } catch (e) {
    console.error("[categories/images] Error al leer de Supabase:", e);
  }

  return jsonWithNoCache({
    nails: memory.nails,
    lashes: memory.lashes,
    updatedAt: memory.updatedAt || Date.now(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const images = {
      nails: typeof body?.nails === "string" && body.nails ? body.nails : memory.nails,
      lashes: typeof body?.lashes === "string" && body.lashes ? body.lashes : memory.lashes,
    };

    // Persistir en Supabase (fuente única de verdad) para que no se pierda en
    // cada cold start o instancia serverless y se refleje de inmediato en la portada.
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "category_images", value: images }, { onConflict: "key" });
    if (error) {
      console.error("[categories/images] No se pudo persistir en Supabase:", error.message);
    }

    memory = { ...images, updatedAt: Date.now() };

    return jsonWithNoCache({ ...images, updatedAt: memory.updatedAt });
  } catch (e) {
    console.error("[categories/images] Error en POST:", e);
    return jsonWithNoCache({
      nails: memory.nails,
      lashes: memory.lashes,
      updatedAt: memory.updatedAt || Date.now(),
    });
  }
}