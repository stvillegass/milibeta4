import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Nunca cachear — leer siempre el valor real de la DB
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "premium_enabled")
      .single();

    if (error || !data) {
      // Fallback seguro: si no existe la clave, asumir habilitado
      return NextResponse.json({ premiumEnabled: true });
    }

    // Supabase devuelve el valor como JSONB (puede ser bool nativo o JSON bool)
    const premiumEnabled = data.value === true || data.value === "true";
    return NextResponse.json({ premiumEnabled });
  } catch {
    return NextResponse.json({ premiumEnabled: true });
  }
}
