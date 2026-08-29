import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import multer from "multer";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getBookingGoogleEventId,
  getBusySlotsForDate,
  listCalendarEvents,
  markBookingCancelled,
  saveGoogleEventId,
} from "./src/lib/googleCalendar";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Web Push VAPID Configuration
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@milibeauty.com";

  let vapidKeys = {
    publicKey: vapidPublicKey || "",
    privateKey: vapidPrivateKey || ""
  };

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    vapidKeys = webpush.generateVAPIDKeys();
  }

  try {
    webpush.setVapidDetails(
      vapidSubject,
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (err) {
    console.error("VAPID configuration warning:", err);
  }

  let pushSubscriptions: webpush.PushSubscription[] = [];

  const upload = multer({ storage: multer.memoryStorage() });

  // Supabase client for validating admin sessions (Bearer token)
  const supabaseClient =
    process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
      ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
      : null;

  // Supabase admin client (service role) para operaciones de escritura
  // que requieren bypass de RLS (ej: app_settings).
  const supabaseAdmin =
    process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : null;

  // In-memory store for services
  let services = [
    {
      id: "s1",
      category: "nails",
      name: "Semipermanente",
      description: "Esmaltado de larga duración con acabado profesional.",
      imageUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop",
      options: [
        { 
          id: "o1", 
          name: "Clásico", 
          price: 25,
          duration: "45 min",
          description: "Limpieza esencial de cutículas y esmaltado semipermanente de alta resistencia.",
          includes: [
            "Limpieza básica de cutículas",
            "Limado y forma de uña",
            "Esmaltado semipermanente monocolor",
            "Hidratación final con aceite de cutículas"
          ]
        },
        { 
          id: "o2", 
          name: "Premium", 
          price: 35,
          duration: "70 min",
          description: "Tratamiento Spa completo con nivelación de Rubber Base y exfoliación nutritiva.",
          includes: [
            "Manicura rusa / combinada profunda",
            "Nivelación estructural con Rubber Base",
            "Esmaltado monocolor + Nail Art sencillo en 2 uñas",
            "Exfoliación suave e hidratación con masaje de manos"
          ]
        }
      ],
      order: 1
    },
    {
      id: "s2",
      category: "nails",
      name: "Esculpidas Acrílicas",
      description: "Extensiones resistentes y elegantes moldeadas a la perfección.",
      imageUrl: "https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?q=80&w=1000&auto=format&fit=crop",
      options: [
        { 
          id: "o3", 
          name: "Clásico", 
          price: 45,
          duration: "90 min",
          description: "Esculpido en acrílico básico de largo corto a mediano.",
          includes: [
            "Preparación antiséptica de uña natural",
            "Esculpido básico en moldes de papel",
            "Limado y sellado de cutícula",
            "Esmaltado semipermanente básico y Top Coat"
          ]
        },
        { 
          id: "o4", 
          name: "Premium", 
          price: 60,
          duration: "120 min",
          description: "Set esculpido avanzado de largo libre con encapsulado o diseño exclusivo.",
          includes: [
            "Manicura rusa de máxima precisión",
            "Esculpido estructural sin límite de largo",
            "Diseño personalizado, Baby Boomer o Encapsulado",
            "Sérum nutritivo y masaje relajante de manos"
          ]
        }
      ],
      order: 2
    },
    {
      id: "s3",
      category: "lashes",
      name: "Lifting de Pestañas",
      description: "Realza tu mirada con un efecto natural y duradero.",
      imageUrl: "https://images.unsplash.com/photo-1588661609100-3490b6cba2d3?q=80&w=1000&auto=format&fit=crop",
      options: [
        { 
          id: "o5", 
          name: "Clásico", 
          price: 30,
          duration: "50 min",
          description: "Curvado y levantamiento de pestañas naturales.",
          includes: [
            "Levantamiento desde la raíz con moldes anatómicos",
            "Tinte negro intenso para mayor volumen visual",
            "Tratamiento sellador de queratina"
          ]
        },
        { 
          id: "o6", 
          name: "Premium", 
          price: 40,
          duration: "75 min",
          description: "Tratamiento Lash Botox nutritivo profundo con perfilado de cejas.",
          includes: [
            "Lifting completo con moldes siliconados",
            "Tinte con complejo nutritivo de pigmentación",
            "Mascara Lash Botox (Ácido Hialurónico + Queratina)",
            "Perfilado y diseño express de cejas incluido"
          ]
        }
      ],
      order: 1
    }
  ];

  // In-memory store for category background images
  let categoryImages = {
    nails: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop",
    lashes: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1000&auto=format&fit=crop"
  };

  app.get("/api/categories/images", (req, res) => {
    res.json(categoryImages);
  });

  app.post("/api/categories/images", (req, res) => {
    if (req.body) {
      if (req.body.nails) categoryImages.nails = req.body.nails;
      if (req.body.lashes) categoryImages.lashes = req.body.lashes;
    }
    res.json(categoryImages);
  });

  // In-memory store for Lookbook Catalog
  let lookbookItems = [
    {
      id: "lb1",
      category: "nails",
      title: "Manicura Rusa & Rubber Base Soft Nude",
      subtitle: "Acabado limpio de cutícula con nivelación ligera y efecto porcelana.",
      imageUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop",
      tag: "Manicure Rusa",
      duration: "60 min",
      details: "Limpieza anatómica de cutícula combinando torno de diamante y tijera de precisión. Nivelación con Rubber Base para máxima durabilidad de 4 semanas.",
      serviceId: "s1"
    },
    {
      id: "lb2",
      category: "lashes",
      title: "Lifting Keratin Lash & Tinte Negro Intenso",
      subtitle: "Elevación orgánica desde la raíz con nutrición intensiva de queratina.",
      imageUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1000&auto=format&fit=crop",
      tag: "Mirada Natural",
      duration: "50 min",
      details: "Curvado natural sin pestañas postizas. Incluye bálsamo Lash Botox y tinte vegetal de alta fijación.",
      serviceId: "s3"
    },
    {
      id: "lb3",
      category: "studio",
      title: "Nuestras Instalaciones de Lujo",
      subtitle: "Espacio privado diseñado para tu máxima relajación e higiene estricta.",
      imageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1000&auto=format&fit=crop",
      tag: "El Studio",
      duration: "Experiencia 5★",
      details: "Camillas ergonómicas de alta densidad, esterilización médica en autoclave y estación de café de cortesía.",
      serviceId: null
    },
    {
      id: "lb4",
      category: "nails",
      title: "Esculpidas en Acrílico Almond French Glazed",
      subtitle: "Forma almendrada refinada con efecto perlado o cromo francés.",
      imageUrl: "https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?q=80&w=1000&auto=format&fit=crop",
      tag: "Diseño Exclusivo",
      duration: "90 min",
      details: "Arquitectura perfecta con curvas C equilibradas, libre de tensión y decorado minimalista hecho a mano.",
      serviceId: "s2"
    },
    {
      id: "lb5",
      category: "lashes",
      title: "Lamination de Cejas & Perfilado Visagista",
      subtitle: "Redirección de vello silvestre para una ceja más poblada y definida.",
      imageUrl: "https://images.unsplash.com/photo-1588661609100-3490b6cba2d3?q=80&w=1000&auto=format&fit=crop",
      tag: "Diseño de Cejas",
      duration: "45 min",
      details: "Estudio previo de morfología facial, fijación del vello y sombreado temporal suave.",
      serviceId: "s3"
    },
    {
      id: "lb6",
      category: "studio",
      title: "Zona de Esterilización & Insumos Premium",
      subtitle: "Empaque individual sellado para cada cliente.",
      imageUrl: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?q=80&w=1000&auto=format&fit=crop",
      tag: "Bioseguridad",
      duration: "Norma ISO",
      details: "Kits de limas descartables, instrumental quirúrgico desinfectado en ultrasonido y embolsado térmico.",
      serviceId: null
    }
  ];

  app.get("/api/lookbook", (req, res) => {
    res.json(lookbookItems);
  });

  app.post("/api/lookbook", (req, res) => {
    const newItem = { ...req.body, id: `lb${Date.now()}` };
    lookbookItems.push(newItem);
    res.json(newItem);
  });

  // In-memory store for client interface configuration
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
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Milibeauty+Studio"
  };

  app.get("/api/site-config", (req, res) => {
    res.json(siteConfig);
  });

  app.post("/api/site-config", (req, res) => {
    if (req.body) {
      siteConfig = { ...siteConfig, ...req.body };
    }
    res.json(siteConfig);
  });

  // --- Configuración global persistida en Supabase (tabla app_settings) ---
  // Lee el valor de premium_enabled desde Supabase. Si no existe o falla,
  // usa el valor por defecto (true).
  async function getPremiumEnabled(): Promise<boolean> {
    if (!supabaseAdmin) return true;
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'premium_enabled')
        .maybeSingle();
      if (error || !data) return true;
      return data.value === true || data.value === 'true';
    } catch (err) {
      console.warn('Error reading premium_enabled from Supabase:', err);
      return true;
    }
  }

  app.get("/api/settings/premium-status", async (req, res) => {
    const premiumEnabled = await getPremiumEnabled();
    res.json({ premiumEnabled });
  });

  app.post("/api/settings/update", async (req, res) => {
    const { key, value } = req.body;
    if (key !== "premium_enabled" || typeof value !== "boolean") {
      return res.status(400).json({ error: "Clave o valor inválido. Uso: { key: 'premium_enabled', value: true|false }" });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase no configurado para persistir configuración" });
    }

    try {
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({ key: 'premium_enabled', value }, { onConflict: 'key' });
      if (error) throw error;
      res.json({ success: true, premiumEnabled: value });
    } catch (err: any) {
      console.error('Error saving premium_enabled to Supabase:', err);
      res.status(500).json({ error: err.message || 'Error al guardar la configuración' });
    }
  });

  app.get("/api/services", async (req, res) => {
    // Si premium está desactivado, excluir servicios con categoría 'premium'
    const premiumEnabled = await getPremiumEnabled();
    const visibleServices = premiumEnabled
      ? services
      : services.filter(s => s.category !== "premium");
    res.json(visibleServices);
  });

  app.post("/api/services", (req, res) => {
    const newService = { ...req.body, id: `s${Date.now()}` };
    services.push(newService);
    res.json(newService);
  });

  app.put("/api/services/:id", (req, res) => {
    const index = services.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
      services[index] = { ...services[index], ...req.body };
      res.json(services[index]);
    } else {
      res.status(404).json({ error: "Service not found" });
    }
  });

  app.delete("/api/services/:id", (req, res) => {
    services = services.filter(s => s.id !== req.params.id);
    res.json({ success: true });
  });

  app.post("/api/services/reorder", (req, res) => {
    const { reorderedServices } = req.body;
    services = reorderedServices;
    res.json({ success: true });
  });

  // In-memory schedule configuration
  let scheduleConfig = {
    weeklySchedule: {
      0: { active: false, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      1: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      2: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      3: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      4: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      5: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      6: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00"] },
    },
    blockedDates: [] as string[],
    blockedNotes: {} as Record<string, string>,
  };

  app.get("/api/schedule", (req, res) => {
    res.json(scheduleConfig);
  });

  app.post("/api/schedule", (req, res) => {
    if (req.body) {
      if (req.body.weeklySchedule) scheduleConfig.weeklySchedule = req.body.weeklySchedule;
      if (req.body.blockedDates) scheduleConfig.blockedDates = req.body.blockedDates;
      if (req.body.blockedNotes) scheduleConfig.blockedNotes = req.body.blockedNotes;
    }
    res.json(scheduleConfig);
  });

  // In-memory store for client bookings
  let bookings: Array<{
    id: string;
    date: string;
    time: string;
    serviceId?: string;
    serviceName?: string;
    optionId?: string;
    optionName?: string;
    price?: number;
    clientName: string;
    clientPhone: string;
    paymentMethod: string;
    referenceNumber?: string;
    createdAt: string;
  }> = [
    // Seed a sample booking so the functionality is immediately verifiable
    {
      id: "b_sample_1",
      date: "2026-08-12",
      time: "10:00",
      serviceId: "s1",
      serviceName: "Manicura Semipermanente",
      optionId: "o1",
      optionName: "Clásico",
      price: 25,
      clientName: "Valentina Mendoza",
      clientPhone: "+584121112233",
      paymentMethod: "pagomovil",
      referenceNumber: "982314",
      createdAt: new Date().toISOString()
    }
  ];

  // Admin Notification System
  let adminNotifications: Array<{
    id: string;
    title: string;
    message: string;
    bookingId: string;
    clientName: string;
    clientPhone: string;
    serviceName: string;
    date: string;
    time: string;
    read: boolean;
    createdAt: string;
  }> = [
    {
      id: "notif_sample_1",
      title: "¡Nueva Reserva Agendada! 💅",
      message: "Valentina Mendoza agendó Manicura Semipermanente (Clásico) para el 2026-08-12 a las 10:00 hs.",
      bookingId: "b_sample_1",
      clientName: "Valentina Mendoza",
      clientPhone: "+584121112233",
      serviceName: "Manicura Semipermanente",
      date: "2026-08-12",
      time: "10:00",
      read: false,
      createdAt: new Date().toISOString()
    }
  ];

  let adminNotificationSettings = {
    webhookUrl: "",
    whatsappNumber: "+584121112233",
    soundEnabled: true,
    pushEnabled: true
  };

  app.get("/api/bookings", (req, res) => {
    res.json(bookings);
  });

  app.post("/api/bookings", async (req, res) => {
    const { date, time, serviceId, serviceName, optionId, optionName, price, clientName, clientPhone, paymentMethod, referenceNumber, durationMinutes } = req.body;

    if (!date || !time) {
      return res.status(400).json({ error: "Fecha y hora son requeridas." });
    }

    // Check if slot is already booked for this date
    const existing = bookings.find(b => b.date === date && b.time === time);
    if (existing) {
      return res.status(400).json({ error: "Este horario ya fue reservado por otra cliente. Por favor elige otro horario." });
    }

    // --- Validación contra Google Calendar (evita doble agendamiento) ---
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const [year, month, day] = date.split('-').map(Number);
      const start = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
      const duration = typeof durationMinutes === 'number' ? durationMinutes : 60;
      const end = new Date(start.getTime() + duration * 60000);

      const busySlots = await getBusySlotsForDate(date);

      // Verificar si el rango [start, end) se solapa con algún evento ocupado
      const hasConflict = busySlots.some(slot => {
        const slotStart = new Date(slot.start).getTime();
        const slotEnd = new Date(slot.end).getTime();
        const reqStart = start.getTime();
        const reqEnd = end.getTime();
        return reqStart < slotEnd && reqEnd > slotStart;
      });

      if (hasConflict) {
        return res.status(400).json({ error: "Este horario ya está reservado en el calendario. Por favor elige otro horario." });
      }
    } catch (err: any) {
      // Si no hay credenciales de Google Calendar configuradas, no bloquear la reserva
      // (el sistema sigue funcionando con la validación en memoria).
      console.warn("Google Calendar availability check skipped:", err?.message || err);
    }

    const newBooking = {
      id: `b_${Date.now()}`,
      date,
      time,
      serviceId,
      serviceName,
      optionId,
      optionName,
      price: typeof price === 'number' ? price : parseFloat(price) || 0,
      clientName: clientName || "Cliente",
      clientPhone: clientPhone || "",
      paymentMethod: paymentMethod || "store",
      referenceNumber: referenceNumber || "",
      createdAt: new Date().toISOString()
    };

    bookings.push(newBooking);

    // Create Admin Notification
    const newNotif = {
      id: `notif_${Date.now()}`,
      title: "¡Nueva Cita Agendada! 💅",
      message: `${newBooking.clientName} agendó ${newBooking.serviceName || 'Servicio'} (${newBooking.optionName || ''}) para el ${newBooking.date} a las ${newBooking.time} hs.`,
      bookingId: newBooking.id,
      clientName: newBooking.clientName,
      clientPhone: newBooking.clientPhone,
      serviceName: newBooking.serviceName || 'Servicio',
      date: newBooking.date,
      time: newBooking.time,
      read: false,
      createdAt: new Date().toISOString()
    };

    adminNotifications.unshift(newNotif);

    // Forward to webhook if configured
    if (adminNotificationSettings.webhookUrl) {
      fetch(adminNotificationSettings.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNotif)
      }).catch(err => console.error("Webhook notification error:", err));
    }

    // Trigger Web Push Notifications to registered admin devices
    const pushPayload = JSON.stringify({
      title: "¡Nueva Cita Agendada! 💅",
      body: `${newBooking.clientName} agendó ${newBooking.serviceName || 'Servicio'} (${newBooking.optionName || ''}) para el ${newBooking.date} a las ${newBooking.time} hs.`,
      url: "/admin",
      bookingId: newBooking.id,
      clientName: newBooking.clientName,
      serviceName: newBooking.serviceName,
      date: newBooking.date,
      time: newBooking.time
    });

    pushSubscriptions.forEach((sub, idx) => {
      webpush.sendNotification(sub, pushPayload).catch((err: any) => {
        console.error(`Web Push notification error for sub #${idx}:`, err.message || err);
        if (err.statusCode === 410 || err.statusCode === 404) {
          pushSubscriptions.splice(idx, 1);
        }
      });
    });

    res.json({ success: true, booking: newBooking, notification: newNotif });
  });

  app.delete("/api/bookings/:id", (req, res) => {
    bookings = bookings.filter(b => b.id !== req.params.id);
    res.json({ success: true });
  });

  // Web Push Subscription Routes
  app.get("/api/push/vapid-key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post("/api/push/subscribe", (req, res) => {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Suscripción Push no válida." });
    }

    const exists = pushSubscriptions.some(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      pushSubscriptions.push(subscription);
    }

    res.json({ success: true, count: pushSubscriptions.length });
  });

  app.post("/api/push/unsubscribe", (req, res) => {
    const { endpoint } = req.body;
    if (endpoint) {
      pushSubscriptions = pushSubscriptions.filter(s => s.endpoint !== endpoint);
    }
    res.json({ success: true });
  });

  app.post("/api/push/test", (req, res) => {
    const testPayload = JSON.stringify({
      title: "Prueba Push MiliBeauty 💅",
      body: "¡Las notificaciones flotantes están activas y funcionando!",
      url: "/admin"
    });

    let sent = 0;
    const promises = pushSubscriptions.map((sub, idx) =>
      webpush.sendNotification(sub, testPayload)
        .then(() => { sent++; })
        .catch(err => {
          console.error(`Test push error for sub #${idx}:`, err.message);
        })
    );

    Promise.all(promises).then(() => {
      res.json({ success: true, subscriptionsCount: pushSubscriptions.length, sent });
    });
  });

  // Admin Notifications Endpoints
  app.get("/api/notifications", (req, res) => {
    res.json({
      notifications: adminNotifications,
      unreadCount: adminNotifications.filter(n => !n.read).length
    });
  });

  app.post("/api/notifications/mark-read", (req, res) => {
    const { id } = req.body;
    if (id) {
      const notif = adminNotifications.find(n => n.id === id);
      if (notif) notif.read = true;
    } else {
      adminNotifications.forEach(n => n.read = true);
    }
    res.json({ success: true });
  });

  app.delete("/api/notifications/:id", (req, res) => {
    adminNotifications = adminNotifications.filter(n => n.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/notification-settings", (req, res) => {
    res.json(adminNotificationSettings);
  });

  app.post("/api/notification-settings", (req, res) => {
    if (req.body) {
      adminNotificationSettings = { ...adminNotificationSettings, ...req.body };
    }
    res.json({ success: true, settings: adminNotificationSettings });
  });

  // Initialize Gemini
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // --- API Routes ---

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google Calendar API
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "No token provided" });

      // Validar que la petición provenga de una sesión de administrador válida
      if (!supabaseClient) {
        return res.status(500).json({ error: "Supabase no configurado" });
      }
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: "Sesión de administrador no válida o expirada" });
      }

      const events = await listCalendarEvents();
      res.json(events);
    } catch (error: any) {
      console.error("Calendar fetch error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/calendar/events", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "No token provided" });
      const { summary, description, start, end } = req.body;

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });
      const calendar = google.calendar({ version: "v3", auth });

      const event = {
        summary,
        description,
        start: { dateTime: start },
        end: { dateTime: end },
      };

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("Calendar insert error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Busy Slots: rangos horarios ocupados en Google Calendar para un día ---
  app.get("/api/busy-slots", async (req, res) => {
    try {
      const { date } = req.query;
      if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Parámetro 'date' inválido. Formato esperado: YYYY-MM-DD" });
      }

      const busySlots = await getBusySlotsForDate(date);
      res.json({ date, busySlots });
    } catch (error: any) {
      console.error("Busy slots fetch error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Gemini APIs
  app.post("/api/gemini/generate-image", async (req, res) => {
    try {
      const { prompt, aspectRatio } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || "1:1",
            imageSize: "1K",
          },
        },
      });

      let imageUrl = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        res.json({ imageUrl });
      } else {
        throw new Error("No image data returned from model");
      }
    } catch (error: any) {
      console.warn("Gemini Image generation fallback triggered due to error/quota limit:", error.message || error);
      
      const promptLower = (req.body?.prompt || "").toLowerCase();
      let fallbackUrl = "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop";
      
      if (promptLower.includes("lash") || promptLower.includes("eyebrow") || promptLower.includes("ceja") || promptLower.includes("pestaña") || promptLower.includes("mirada")) {
        fallbackUrl = "https://images.unsplash.com/photo-1588661609100-3490b6cba2d3?q=80&w=1000&auto=format&fit=crop";
      } else if (promptLower.includes("nail") || promptLower.includes("manicure") || promptLower.includes("uña")) {
        fallbackUrl = "https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?q=80&w=1000&auto=format&fit=crop";
      }

      res.json({ 
        imageUrl: fallbackUrl,
        isFallback: true,
        message: "Se asignó una imagen HD recomendada debido a la cuota temporal de IA."
      });
    }
  });

  app.post("/api/gemini/analyze-image", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image provided" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            inlineData: {
              data: req.file.buffer.toString("base64"),
              mimeType: req.file.mimetype,
            },
          },
          "Describe this image related to beauty, nails, or lashes. What is the style?",
        ],
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Image analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  });


  // --- Google Calendar Sync ---
  app.post("/api/calendar/sync", async (req, res) => {
    try {
      const { bookingId, clientName, serviceName, optionName, startTime, endTime } = req.body;

      if (!bookingId || !startTime || !endTime) {
        return res.status(400).json({ error: "Missing required booking details" });
      }

      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
      const calendarId = process.env.GOOGLE_CALENDAR_ID;

      // Validación explícita de credenciales
      const missing: string[] = [];
      if (!clientEmail) missing.push('GOOGLE_CLIENT_EMAIL');
      if (!rawPrivateKey) missing.push('GOOGLE_PRIVATE_KEY');
      if (!calendarId) missing.push('GOOGLE_CALENDAR_ID');

      if (missing.length > 0) {
        console.warn(`Google Calendar credentials missing (${missing.join(', ')}). Skipping sync.`);
        return res.json({ message: "Skipped (no credentials)", missing });
      }

      // Normalizar la clave privada: reemplaza \n literales por saltos de línea reales
      const privateKey = rawPrivateKey!.replace(/\\n/g, '\n');

      const eventId = await createCalendarEvent({
        summary: `Reserva: ${clientName} - ${serviceName}`,
        description: `Servicio: ${serviceName} (${optionName})\nCliente: ${clientName}`,
        startTime,
        endTime,
      });

      // Guarda google_event_id y marca synced_to_calendar = true
      // (usando la clave de service role, bypassa RLS).
      if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await saveGoogleEventId(bookingId, eventId);
      }

      res.json({ success: true, eventId, synced: true });
    } catch (error: any) {
      console.error("Google Calendar Sync Error:", error);
      res.status(500).json({ error: error.message, synced: false });
    }
  });

  // Cancela una reserva: elimina el evento de Google Calendar y
  // marca la reserva como 'cancelled' + synced_to_calendar = false.
  app.post("/api/calendar/cancel", async (req, res) => {
    try {
      const { bookingId } = req.body;
      if (!bookingId) {
        return res.status(400).json({ error: "bookingId es requerido" });
      }

      const eventId = await getBookingGoogleEventId(bookingId);

      if (eventId && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CALENDAR_ID) {
        try {
          await deleteCalendarEvent(eventId);
        } catch (err: any) {
          console.warn("No se pudo eliminar el evento de Google (puede ya no existir):", err.message);
        }
      }

      if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await markBookingCancelled(bookingId);
      }

      return res.json({ success: true, googleEventId: eventId || null });
    } catch (error: any) {
      console.error("Google Calendar Cancel Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
