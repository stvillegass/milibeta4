import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Deshabilitar caché de Next.js: cada petición lee el estado real de Supabase
export const dynamic = "force-dynamic";

let siteConfig = {
  studioName: "Milibeauty",
  studioSubtitle: "Estudio de lujo especializado en el cuidado y diseño de tus manos y mirada.",
  nailsTag: "Especialidad",
  nailsTitle: "Manicure",
  nailsDescription: "Manicura, pedicura y cuidado de uñas",
  lashesTag: "Especialidad",
  lashesTitle: "Cejas y Pestañas",
  lashesDescription: "Lifting, diseño y realce de mirada",
  badge1: "Productos Premium",
  badge2: "Citas Flexibles",
  badge3: "Higiene Estricta",
  studioAddress: "Av. Principal Las Mercedes, Edificio Centro Empresarial, Piso 3, Local 302",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Milibeauty+Studio",
  // Datos bancarios para Pago Móvil y Transferencia
  bankName: "Banesco (0134)",
  bankId: "V-26123456",
  bankPhone: "0412-1234567",
  bankOwner: "Milibeauty C.A.",
  // Modalidad Premium
  premiumEnabled: true,
  // Plantilla de recordatorio por WhatsApp (variables: {nombre}, {servicio}, {fecha}, {hora})
  whatsappReminderTemplate:
    "¡Hola {nombre}! ✨ Se acerca el tiempo ideal para el retoque de tu servicio de {servicio}. Tu cita fue el {fecha} a las {hora}. ¿Te gustaría agendar tu cita para esta semana?",
  // Plantilla de confirmación de reserva por WhatsApp (variables: {nombre}, {servicio}, {fecha}, {hora})
  whatsappConfirmationTemplate:
    "¡Hola {nombre}! 🌸 Tu cita en Milibeauty quedó confirmada: {servicio} el {fecha} a las {hora}. ¡Te esperamos! 💅✨",
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["site_config", "premium_enabled"]);

    if (!error && data && data.length > 0) {
      data.forEach((item) => {
        if (item.key === "site_config" && typeof item.value === "object" && item.value !== null) {
          siteConfig = { ...siteConfig, ...item.value };
        }
        if (item.key === "premium_enabled") {
          siteConfig.premiumEnabled = Boolean(item.value);
        }
      });
    }
  } catch (e) {
    console.error("Error reading site_config from Supabase:", e);
  }

  return NextResponse.json(siteConfig);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body) {
      siteConfig = { ...siteConfig, ...body };

      // Guardar en Supabase app_settings
      await Promise.all([
        supabase.from("app_settings").upsert(
          { key: "site_config", value: siteConfig },
          { onConflict: "key" }
        ),
        supabase.from("app_settings").upsert(
          { key: "premium_enabled", value: Boolean(siteConfig.premiumEnabled) },
          { onConflict: "key" }
        ),
      ]);
    }
  } catch (e) {
    console.error("Error saving site_config to Supabase:", e);
  }

  return NextResponse.json(siteConfig);
}