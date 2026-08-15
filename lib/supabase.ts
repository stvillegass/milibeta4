import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ ERROR: No se pudieron leer las variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY)."
  );
} else {
  console.log("✅ Conexión con Supabase configurada exitosamente.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);