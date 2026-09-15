import { NextResponse } from "next/server";
import {
  NO_STORE_HEADERS,
  getCachedPremiumEnabled,
} from "@/lib/appCache";

// Respuesta siempre fresca: el valor se lee de la caché de datos (tag
// `premium-enabled`) que el panel invalida al instante cuando guarda cambios.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stored = await getCachedPremiumEnabled();

    if (stored === null || stored === undefined) {
      // Fallback seguro: si no existe la clave, asumir habilitado
      return NextResponse.json({ premiumEnabled: true }, { headers: NO_STORE_HEADERS });
    }

    // Supabase devuelve el valor como JSONB (puede ser bool nativo o JSON bool)
    const premiumEnabled = stored === true || stored === "true";
    return NextResponse.json({ premiumEnabled }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ premiumEnabled: true }, { headers: NO_STORE_HEADERS });
  }
}
