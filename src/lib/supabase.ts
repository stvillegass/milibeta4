import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: No se pudieron leer las variables de entorno de Supabase (VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY).");
} else {
  console.log("✅ Conexión con Supabase configurada exitosamente.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
