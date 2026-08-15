import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listCalendarEvents } from "@/lib/googleCalendar";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) return NextResponse.json({ error: "No token provided" }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Sesión de administrador no válida o expirada" }, { status: 401 });
    }

    const events = await listCalendarEvents();
    return NextResponse.json(events);
  } catch (error: any) {
    console.error("Calendar fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}