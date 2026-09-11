#!/usr/bin/env node
/**
 * PRUEBA PILOTO — Envio de mensajes de prueba via Evolution API v2.3.7
 * =====================================================================
 * Simula (1) la confirmacion de una cita y (2) el recordatorio automatico
 * de retoque, usando EXACTAMENTE los mismos valores de configuracion
 * (variables WHATSAPP_*), el mismo endpoint y el mismo payload que la
 * app real usa en lib/whatsapp.ts.
 *
 * Uso:
 *   node scripts/test-whatsapp-piloto.mjs 584XXXXXXXXX
 *   node scripts/test-whatsapp-piloto.mjs --only=confirmation 584XXXXXXXXX
 *   node scripts/test-whatsapp-piloto.mjs --only=reminder 584XXXXXXXXX
 *
 * Si no se pasa numero por parametro, se usa el numero de prueba
 * definido en WHATSAPP_TEST_PHONE (opcional) del .env, o se aborta.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ---------------------------------------------------------------
// Mini cargador de .env (sin dependencias). Prioridad: .env.local > .env
// ---------------------------------------------------------------
function loadEnv(file) {
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    let key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\n/g, "\n");
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv(path.join(ROOT, ".env"));
loadEnv(path.join(ROOT, ".env.local"));

// ---------------------------------------------------------------
// Configuracion desde las mismas variables de entorno de la app
// ---------------------------------------------------------------
const apiUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "";
const apiKey = process.env.EVOLUTION_API_KEY || "";

// Plantillas copiadas literalmente de lib/whatsapp.ts
const CONFIRMATION_TEMPLATE =
  "¡Hola {nombre}! 🌸 Tu cita en Milibeauty quedó confirmada: {servicio} el {fecha} a las {hora}. ¡Te esperamos! 💅✨";
const REMINDER_TEMPLATE =
  "¡Hola {nombre}! ✨ Se acerca el tiempo ideal para el retoque de tu servicio de {servicio}. Tu cita fue el {fecha} a las {hora}. ¿Te gustaría agendar tu cita para esta semana?";

// Misma logica de normalizacion que sanitizePhoneNumber() en lib/whatsapp.ts
function sanitizePhoneNumber(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  let n = digits.startsWith("00") ? digits.slice(2) : digits;
  n = n.startsWith("0") ? n.slice(1) : n;
  if (n.startsWith("58") && n.length >= 12) return n;
  return "58" + n;
}

function formatText(template, values) {
  return template
    .replace(/\{nombre\}/gi, values.nombre)
    .replace(/\{servicio\}/gi, values.servicio)
    .replace(/\{fecha\}/gi, values.fecha)
    .replace(/\{hora\}/gi, values.hora);
}

// Formatea una fecha ISO en fecha/hora legibles (igual que formatReminderDate)
function formatReminderDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { fecha: iso, hora: "" };
  const fecha = date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hora = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return { fecha, hora };
}

// ---------------------------------------------------------------
// Envio (misma forma que sendWhatsAppConfirmation / sendWhatsAppReminder)
// ---------------------------------------------------------------
async function sendTestMessage({ number, text, label }) {
  const endpoint = `${apiUrl}/message/sendText/${instanceName}`;
  const payload = { number, text };

  console.log(`\n🎯 [${label}]`);
  console.log("   Endpoint:", endpoint);
  console.log("   Payload  :", JSON.stringify(payload));

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(payload),
    });

    let responseBody = null;
    try {
      responseBody = await response.text();
    } catch {
      responseBody = "(sin body legible)";
    }

    console.log(`   Respuesta Evolution API -> status=${response.status} (${response.statusText}) ok=${response.ok}`);
    console.log("   Body:", responseBody);

    return { ok: response.ok, status: response.status, body: responseBody };
  } catch (error) {
    console.error("   ERROR (red/infraestructura):", error);
    return { ok: false, status: 0, body: String(error) };
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
function parseArgs(argv) {
  const args = { only: null, phone: null };
  for (const a of argv) {
    if (a.startsWith("--only=")) args.only = a.split("=")[1];
    else if (/^\d[\d+()\-\s]*$/.test(a)) args.phone = a;
  }
  return args;
}

const { only, phone: phoneArg } = parseArgs(process.argv.slice(2));
const phone = phoneArg || process.env.WHATSAPP_TEST_PHONE || "";

console.log("=============================================================");
console.log(" PRUEBA PILOTO WhatsApp (Evolution API)");
console.log("=============================================================");
console.log("Configuracion detectada:");
console.log("  EVOLUTION_API_URL        :", apiUrl || "(vacio)");
console.log("  EVOLUTION_INSTANCE_NAME  :", instanceName || "(vacio)");
console.log("  EVOLUTION_API_KEY        :", apiKey ? `${apiKey.slice(0, 3)}...${apiKey.slice(-3)}` : "(vacio)");
console.log("  Numero destino (crudo)  :", phone || "(vacio)");
console.log("  Numero destino (normaliz):", sanitizePhoneNumber(phone));

if (!apiUrl || !instanceName || !apiKey) {
  console.error("\n❌ Faltan variables de entorno EVOLUTION_API_URL, EVOLUTION_INSTANCE_NAME o EVOLUTION_API_KEY.");
  process.exit(1);
}

if (!phone) {
  console.error("\n❌ No se indico numero de telefono. Uso: node scripts/test-whatsapp-piloto.mjs 584XXXXXXXXX");
  process.exit(1);
}

const number = sanitizePhoneNumber(phone);
if (!number) {
  console.error(`\n❌ Numero invalido (sin digitos): "${phone}"`);
  process.exit(1);
}

// Datos ficticios de la cita para rellenar las plantillas
const fakeBooking = {
  nombre: "Cliente Prueba",
  servicio: "Semipermanente (Clásico)",
  startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // manana
};

const { fecha, hora } = formatReminderDate(fakeBooking.startTime);

const tests = [];
if (only === "confirmation" || !only) {
  tests.push({
    label: "CONFIRMACION DE CITA",
    number,
    text: formatText(CONFIRMATION_TEMPLATE, { nombre: fakeBooking.nombre, servicio: fakeBooking.servicio, fecha, hora }),
  });
}
if (only === "reminder" || !only) {
  tests.push({
    label: "RECORDATORIO DE RETOQUE",
    number,
    text: formatText(REMINDER_TEMPLATE, { nombre: fakeBooking.nombre, servicio: fakeBooking.servicio, fecha, hora }),
  });
}

const results = [];
for (const t of tests) {
  results.push(await sendTestMessage(t));
}

// Resumen final
console.log("\n-------------------------------------------------------------");
console.log(" RESUMEN DE LA PRUEBA PILOTO");
console.log("-------------------------------------------------------------");
let allOk = true;
for (let i = 0; i < tests.length; i++) {
  const r = results[i];
  const status = r.status;
  const verdict = status === 200 || status === 201 ? "✅ ENVIADO" : `❌ ERROR HTTP ${status}`;
  if (status !== 200 && status !== 201) allOk = false;
  console.log(`  [${tests[i].label}] status=${status} -> ${verdict}`);
}
console.log(allOk ? "\n✅ Prueba piloto completada con exito." : "\n⚠️ Revisar los errores anteriores.");