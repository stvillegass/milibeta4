import { createClient } from "@supabase/supabase-js";

/**
 * Helper para enviar recordatorios de citas por WhatsApp.
 * Utiliza la Evolution API y una plantilla editable configurada en
 * la tabla `app_settings` de Supabase (clave `site_config.whatsappReminderTemplate`).
 */

/** Plantilla por defecto en caso de que no exista configuración guardada. */
const DEFAULT_TEMPLATE =
  "¡Hola {nombre}! ✨ Se acerca el tiempo ideal para el retoque de tu servicio de {servicio}. Tu cita fue el {fecha} a las {hora}. ¿Te gustaría agendar tu cita para esta semana?";

/** Plantilla por defecto de confirmación de reserva en caso de que no exista configuración guardada. */
const DEFAULT_CONFIRMATION_TEMPLATE =
  "¡Hola {nombre}! 🌸 Tu cita en Milibeauty quedó confirmada: {servicio} el {fecha} a las {hora}. ¡Te esperamos! 💅✨";

/**
 * Lee una plantilla desde Supabase (app_settings -> site_config).
 * Si no existe, devuelve la plantilla por defecto.
 * @param key - Clave en `site_config` (ej: whatsappReminderTemplate).
 * @param fallback - Plantilla por defecto.
 * @param supabase - Cliente Supabase (opcional). Si no se pasa, lo crea con service_role.
 */
async function getSiteConfigTemplate(
  key: string,
  fallback: string,
  supabase?: any
): Promise<string> {
  // Reutilizar el cliente si viene dado (p.ej. desde el cron), si no crear uno
  const client =
    supabase ||
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

  try {
    const { data, error } = await client
      .from("app_settings")
      .select("value")
      .eq("key", "site_config")
      .single();

    if (error || !data?.value) {
      return fallback;
    }

    const value = data.value as Record<string, unknown>;
    const template = value[key] as string | undefined;

    return template && template.trim().length > 0 ? template : fallback;
  } catch (e) {
    console.error(`❌ Error leyendo plantilla (${key}) de site_config:`, e);
    return fallback;
  }
}

/**
 * Lee la plantilla de recordatorio desde Supabase (app_settings -> site_config).
 * Si no existe, devuelve la plantilla por defecto.
 * @param supabase - Cliente Supabase (opcional). Si no se pasa, lo crea con service_role.
 */
async function getReminderTemplate(
  supabase?: any
): Promise<string> {
  return getSiteConfigTemplate(
    "whatsappReminderTemplate",
    DEFAULT_TEMPLATE,
    supabase
  );
}

/**
 * Lee la plantilla de confirmación de reserva desde Supabase (app_settings -> site_config).
 * Si no existe, devuelve la plantilla por defecto.
 * @param supabase - Cliente Supabase (opcional). Si no se pasa, lo crea con service_role.
 */
async function getConfirmationTemplate(
  supabase?: any
): Promise<string> {
  return getSiteConfigTemplate(
    "whatsappConfirmationTemplate",
    DEFAULT_CONFIRMATION_TEMPLATE,
    supabase
  );
}

/**
 * Reemplaza las etiquetas dinámicas {nombre}, {servicio}, {fecha} y {hora}
 * por los datos reales de la reserva.
 */
function formatText(
  template: string,
  values: { nombre: string; servicio: string; fecha: string; hora: string }
): string {
  return template
    .replace(/\{nombre\}/gi, values.nombre)
    .replace(/\{servicio\}/gi, values.servicio)
    .replace(/\{fecha\}/gi, values.fecha)
    .replace(/\{hora\}/gi, values.hora);
}

/**
 * Normaliza un número de teléfono a formato internacional completo sin "+", espacios ni guiones.
 *
 * Casos soportados (Evolución API / WhatsApp espera formato E.164 sin "+", ej. "584121234567"):
 *   - "+584121234567"  → "584121234567"
 *   - "584121234567"   → "584121234567"
 *   - "0412-1234567"   → "584121234567"   (formato nacional VE con 0 inicial + código de área USA)
 *   - "04121234567"    → "584121234567"
 *   - "4121234567"     → "584121234567"   (solo código de área + número)
 *
 * @param raw - Número tal como lo ingresó la clienta.
 * @returns Número normalizado en formato internacional, o "" si el input no tiene dígitos.
 */
export function sanitizePhoneNumber(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";

  // Quitar prefijo internacional italiano/telefónico "00" si lo usan
  let n = digits.startsWith("00") ? digits.slice(2) : digits;

  // Quitar el "0" inicial del formato nacional (0412 -> 412)
  n = n.startsWith("0") ? n.slice(1) : n;

  // Si ya trae código de país (58 para Venezuela) lo dejamos tal cual
  if (n.startsWith("58") && n.length >= 12) return n;

  // Si no trae código de país, se asume formato nacional y se antepone el código de Venezuela (+58)
  return "58" + n;
}

/**
 * Formatea una fecha ISO en texto legible (es-ES) para el recordatorio.
 */
export function formatReminderDate(iso: string): {
  fecha: string;
  hora: string;
} {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { fecha: iso, hora: "" };
  }
  const fecha = date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hora = date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { fecha, hora };
}

/**
 * Envía un recordatorio de retoque por WhatsApp al cliente.
 *
 * @param phone - Número de teléfono del cliente (formato internacional, ej. +584121234567).
 * @param clientName - Nombre completo del cliente.
 * @param serviceName - Nombre del servicio contratado.
 * @param startTime - (Opcional) Fecha/hora de la cita en ISO. Se usa para {fecha} y {hora}.
 * @param supabase - (Opcional) Cliente Supabase reutilizable.
 * @returns `true` si el envío fue exitoso, `false` en caso de error.
 */
export async function sendWhatsAppReminder(
  phone: string,
  clientName: string,
  serviceName: string,
  startTime?: string,
  supabase?: any
): Promise<boolean> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const instanceName = process.env.WHATSAPP_INSTANCE_NAME;
  const apiKey = process.env.WHATSAPP_API_TOKEN;

  console.log("🟡 [sendWhatsAppReminder] Env vars:", {
    WHATSAPP_API_URL: apiUrl || "(vacío)",
    WHATSAPP_INSTANCE_NAME: instanceName || "(vacío)",
    WHATSAPP_API_TOKEN: apiKey ? `${apiKey.slice(0, 3)}...${apiKey.slice(-3)}` : "(vacío)",
    phoneRecibido: phone,
  });

  if (!apiUrl || !instanceName || !apiKey) {
    console.error(
      "❌ ERROR: Faltan variables de entorno WHATSAPP_API_URL, WHATSAPP_INSTANCE_NAME o WHATSAPP_API_TOKEN."
    );
    return false;
  }

  // Obtener la plantilla guardada desde Supabase
  const template = await getReminderTemplate(supabase);

  // Fecha y hora de la cita (si están disponibles)
  const { fecha, hora } = startTime
    ? formatReminderDate(startTime)
    : { fecha: "", hora: "" };

  // Reemplazar las etiquetas dinámicas
  const message = formatText(template, {
    nombre: clientName,
    servicio: serviceName,
    fecha,
    hora,
  });

  // La Evolution API espera el número en formato internacional sin "+" (ej. 58412XXXXXXX)
  const number = sanitizePhoneNumber(phone);
  console.log("🟡 [sendWhatsAppReminder] Número normalizado:", {
    original: phone,
    normalizado: number,
  });
  if (!number) {
    console.error(`❌ ERROR: Número inválido (sin dígitos): "${phone}"`);
    return false;
  }

  try {
    const endpoint = `${apiUrl.replace(/\/$/, "")}/message/sendText/${instanceName}`;
    const payload = { number, text: message };
    console.log("🟡 [sendWhatsAppReminder] POST a Evolution API:", { endpoint, payload });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify(payload),
    });

    // Leer el body de la respuesta para diagnóstico
    let responseBody: unknown = null;
    try {
      responseBody = await response.text();
    } catch {
      responseBody = "(no readable body)";
    }

    console.log(
      `🟡 [sendWhatsAppReminder] Respuesta Evolution API -> status=${response.status} (${response.statusText}) ok=${response.ok} body=${responseBody}`
    );

    if (!response.ok) {
      console.error(
        `❌ ERROR enviando WhatsApp a ${phone}: HTTP ${response.status} ${response.statusText} - ${responseBody}`
      );
      return false;
    }

    console.log(`✅ Recordatorio WhatsApp enviado a ${phone} (${clientName}).`);
    return true;
  } catch (error) {
    console.error(`❌ ERROR en sendWhatsAppReminder para ${phone}:`, error);
    return false;
  }
}

/**
 * Envía un mensaje automático de confirmación de reserva por WhatsApp a la clienta.
 * Se dispara justo después de guardar exitosamente la cita en el backend.
 *
 * @param phone - Número de teléfono de la clienta (formato internacional, ej. +584121234567).
 * @param clientName - Nombre completo de la clienta.
 * @param serviceName - Nombre del servicio (puede incluir la opción, ej. "Manicure (Gel)").
 * @param opts - Opciones: `fecha` y `hora` pre-formateadas (se usan tal cual);
 *               `startTime` ISO como respaldo si no se pasan; `supabase` cliente reutilizable.
 * @returns `true` si el envío fue exitoso, `false` en caso de error (nunca lanza).
 */
export async function sendWhatsAppConfirmation(
  phone: string,
  clientName: string,
  serviceName: string,
  opts: {
    fecha?: string;
    hora?: string;
    startTime?: string;
    supabase?: any;
  } = {}
): Promise<boolean> {
  const { fecha: fechaOpt, hora: horaOpt, startTime, supabase } = opts;

  const apiUrl = process.env.WHATSAPP_API_URL;
  const instanceName = process.env.WHATSAPP_INSTANCE_NAME;
  const apiKey = process.env.WHATSAPP_API_TOKEN;

  console.log("🟡 [sendWhatsAppConfirmation] Env vars:", {
    WHATSAPP_API_URL: apiUrl || "(vacío)",
    WHATSAPP_INSTANCE_NAME: instanceName || "(vacío)",
    WHATSAPP_API_TOKEN: apiKey ? `${apiKey.slice(0, 3)}...${apiKey.slice(-3)}` : "(vacío)",
    phoneRecibido: phone,
    clientName,
    serviceName,
  });

  if (!apiUrl || !instanceName || !apiKey) {
    console.error(
      "❌ ERROR: Faltan variables de entorno WHATSAPP_API_URL, WHATSAPP_INSTANCE_NAME o WHATSAPP_API_TOKEN."
    );
    return false;
  }

  try {
    // Obtener la plantilla de confirmación guardada desde Supabase
    const template = await getConfirmationTemplate(supabase);

    // Fecha y hora: se usan las pre-formateadas si vienen de la clienta; si no, se derivan de startTime
    let fecha = fechaOpt;
    let hora = horaOpt;
    if ((!fecha || !hora) && startTime) {
      const derived = formatReminderDate(startTime);
      fecha = fecha || derived.fecha;
      hora = hora || derived.hora;
    }

    // Reemplazar las etiquetas dinámicas
    const message = formatText(template, {
      nombre: clientName,
      servicio: serviceName,
      fecha: fecha || "",
      hora: hora || "",
    });

    // La Evolution API espera el número en formato internacional sin "+" (ej. 58412XXXXXXX)
    const number = sanitizePhoneNumber(phone);
    console.log("🟡 [sendWhatsAppConfirmation] Número normalizado:", {
      original: phone,
      normalizado: number,
    });
    console.log("🟡 [sendWhatsAppConfirmation] Mensaje a enviar:", message);
    if (!number) {
      console.error(`❌ ERROR: Número inválido (sin dígitos): "${phone}"`);
      return false;
    }

    const endpoint = `${apiUrl.replace(/\/$/, "")}/message/sendText/${instanceName}`;
    const payload = { number, text: message };
    console.log("🟡 [sendWhatsAppConfirmation] POST a Evolution API:", { endpoint, payload });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify(payload),
    });

    // Leer el body de la respuesta para diagnóstico
    let responseBody: unknown = null;
    try {
      responseBody = await response.text();
    } catch {
      responseBody = "(no readable body)";
    }

    console.log(
      `🟡 [sendWhatsAppConfirmation] Respuesta Evolution API -> status=${response.status} (${response.statusText}) ok=${response.ok} body=${responseBody}`
    );

    if (!response.ok) {
      console.error(
        `❌ ERROR enviando confirmación WhatsApp a ${phone}: HTTP ${response.status} ${response.statusText} - ${responseBody}`
      );
      return false;
    }

    console.log(`✅ Confirmación WhatsApp enviada a ${phone} (${clientName}).`);
    return true;
  } catch (error) {
    console.error(`❌ ERROR en sendWhatsAppConfirmation para ${phone}:`, error);
    return false;
  }
}