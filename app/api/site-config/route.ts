import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  CACHE_TAGS,
  NO_STORE_HEADERS,
  getCachedPremiumEnabled,
  getCachedSiteConfig,
  revalidateAppCache,
} from "@/lib/appCache";

const DEFAULT_SITE_CONFIG = {
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

/**
 * GET — configuración pública del sitio.
 *
 * Se sirve desde la caché de datos de Next (`unstable_cache`) con el tag
 * `site-config` / `premium-enabled`: se evita golpear Supabase en cada visita y,
 * cuando el panel guarda cambios, el tag se invalida al instante.
 */
export async function GET() {
  let config: Record<string, unknown> = { ...DEFAULT_SITE_CONFIG };

  try {
    const [stored, premium] = await Promise.all([
      getCachedSiteConfig(),
      getCachedPremiumEnabled(),
    ]);

    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      config = { ...config, ...(stored as Record<string, unknown>) };
    }
    if (premium !== null && premium !== undefined) {
      config.premiumEnabled = premium === true || premium === "true";
    }
  } catch (e) {
    console.error("Error reading site_config from Supabase:", e);
  }

  return NextResponse.json(config, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Datos de configuración inválidos" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const current = (await getCachedSiteConfig()) as Record<string, unknown> | null;
    const merged = {
      ...DEFAULT_SITE_CONFIG,
      ...(current && typeof current === "object" ? current : {}),
      ...body,
    };

    // Guardar en Supabase app_settings (fuente de verdad persistente)
    const [siteRes, premiumRes] = await Promise.all([
      supabase
        .from("app_settings")
        .upsert({ key: "site_config", value: merged }, { onConflict: "key" }),
      supabase
        .from("app_settings")
        .upsert(
          { key: "premium_enabled", value: Boolean(merged.premiumEnabled) },
          { onConflict: "key" }
        ),
    ]);

    if (siteRes.error || premiumRes.error) {
      console.error(
        "[site-config] Error al persistir:",
        siteRes.error?.message || premiumRes.error?.message
      );
      return NextResponse.json(
        { error: "No se pudo guardar la configuración" },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    // Invalidar el caché al instante para que la vista pública se actualice ya
    const revalidated = revalidateAppCache([
      CACHE_TAGS.siteConfig,
      CACHE_TAGS.premiumEnabled,
      CACHE_TAGS.categoryImages,
    ]);

    return NextResponse.json(merged, {
      headers: { ...NO_STORE_HEADERS, "X-Revalidated-Tags": revalidated.join(",") },
    });
  } catch (e) {
    console.error("Error saving site_config to Supabase:", e);
    return NextResponse.json(
      { error: "Error al guardar la configuración" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
