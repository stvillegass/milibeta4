"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  format,
  isBefore,
  startOfToday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addDays,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowRight,
  User,
  Calendar as CalendarIcon,
  Smartphone,
  Banknote,
  Building2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  MessageCircle,
  Sparkles,
  AlertCircle,
  MapPin,
  Navigation,
} from "lucide-react";
import { Service } from "@/types";
import LocationModal from "./LocationModal";
import { supabase } from "@/lib/supabase";
import { formatTime12h } from "@/lib/timeFormat";

// Imagen de respaldo cuando un servicio no tiene image_url (nulo/vacío)
const FALLBACK_SERVICE_IMAGE =
  "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop";

interface ReservationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialServiceId?: string | null;
  initialOptionId?: string | null;
}

export default function ReservationModal({
  isOpen = true,
  onClose,
  initialServiceId,
  initialOptionId,
}: ReservationModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const serviceIdParam = initialServiceId || searchParams.get("service");
  const optionIdParam = initialOptionId || searchParams.get("option");

  const [allServices, setAllServices] = useState<Service[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [option, setOption] = useState<any>(null);
  const [scheduleConfig, setScheduleConfig] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);

  const [step, setStep] = useState<"select" | "checkout" | "confirmed">("select");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [tempTime, setTempTime] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"pagomovil" | "transferencia" | "store">("pagomovil");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPaymentExpanded, setIsPaymentExpanded] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [siteConfig, setSiteConfig] = useState({
    studioName: "Milibeauty",
    studioAddress: "Av. Principal Las Mercedes, Edificio Centro Empresarial, Piso 3, Local 302",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Milibeauty+Studio",
    bankName: "Banesco (0134)",
    bankId: "V-26123456",
    bankPhone: "0412-1234567",
    bankOwner: "Milibeauty C.A.",
    premiumEnabled: true,
  });

  // Estado dedicado para el toggle premium — sincronizado via Supabase Realtime
  const [isPremiumEnabled, setIsPremiumEnabled] = useState(true);

  useEffect(() => {
    // ── 1. Obtener el valor inicial de premium_enabled ───────────────────
    const fetchInitialSetting = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "premium_enabled")
        .single();

      if (data) {
        // Soporta JSONB bool (true/false) y string ('true'/'false')
        setIsPremiumEnabled(data.value === true || data.value === "true");
      }
    };

    fetchInitialSetting();

    // ── 2. Suscribirse a los cambios en tiempo real ────────────────────
    // Cuando el admin activa/desactiva el toggle, este canal notifica
    // instantáneamente a TODOS los clientes conectados.
    const channel = supabase
      .channel("app_settings_realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "app_settings",
          filter: "key=eq.premium_enabled",
        },
        (payload) => {
          const raw = (payload.new as any).value;
          const newValue = raw === true || raw === "true";
          console.log("[Realtime] premium_enabled →", newValue);
          setIsPremiumEnabled(newValue);
        }
      )
      .subscribe();

    // ── Cargar el resto de la configuración (banco, dirección, etc.) ───
    const loadRestConfig = async () => {
      try {
        const { data: siteConfigRow } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "site_config")
          .single();

        const res = await fetch("/api/site-config");
        const apiData = await res.json();

        setSiteConfig((prev) => {
          const merged = { ...prev, ...(apiData || {}) };
          if (
            siteConfigRow?.value &&
            typeof siteConfigRow.value === "object"
          ) {
            Object.assign(merged, siteConfigRow.value);
          }
          return merged;
        });
      } catch (err) {
        console.error("[ReservationModal] Error cargando site-config:", err);
      }
    };

    loadRestConfig();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: sData, error: sErr } = await supabase
          .from("services")
          .select("*, service_options(*)")
          .order("order_index", { ascending: true });

        if (sErr) console.error("Error fetching services:", sErr);

        const mappedServices: Service[] =
          sData && sData.length > 0
            ? sData.map((s: any) => ({
                id: s.id,
                name: s.name,
                category: s.category,
                description: s.description,
                imageUrl: s.image_url,
                order: s.order_index,
                options: (s.service_options || []).map((o: any) => ({
                  id: o.id,
                  name: o.name,
                  price: Number(o.price),
                  duration: o.duration_minutes ? `${o.duration_minutes} min` : "60 min",
                })),
              }))
            : [];

        setAllServices(mappedServices);

        if (mappedServices.length > 0) {
          setService((prev) => {
            const stillExists = prev && mappedServices.some((s) => s.id === prev.id);
            if (stillExists) return prev;
            const foundService = serviceIdParam
              ? mappedServices.find((x) => x.id === serviceIdParam)
              : mappedServices[0];
            return foundService || mappedServices[0];
          });

          setOption((prev: any) => {
            let targetService = service;
            if (!targetService && mappedServices.length > 0) {
              targetService = serviceIdParam
                ? mappedServices.find((x) => x.id === serviceIdParam) ?? null
                : mappedServices[0] ?? null;
              targetService = targetService || (mappedServices[0] ?? null);
            }
            if (!targetService) return prev;

            if (prev && targetService.options.some((o) => o.id === prev.id)) {
              return prev;
            }
            const foundOption = optionIdParam
              ? targetService.options.find((o: any) => o.id === optionIdParam)
              : targetService.options[0];
            return foundOption || targetService.options[0];
          });
        }

        const { data: schedData } = await supabase.from("schedules").select("*");
        const { data: blockData } = await supabase.from("blocked_dates").select("*");

        const defaultWeekly: any = {
          0: { active: false, slots: [] },
          1: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
          2: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
          3: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
          4: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
          5: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
          6: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00"] },
        };

        const newWeekly: any = { ...defaultWeekly };
        if (schedData && schedData.length > 0) {
          for (let i = 0; i < 7; i++) {
            newWeekly[i] = { active: false, slots: [] };
          }
          schedData.forEach((s: any) => {
            newWeekly[s.day_of_week] = { active: s.is_active, slots: s.slots || [] };
          });
        }

        const newBlockedDates = (blockData || []).map((b: any) => b.date);

        setScheduleConfig({
          weeklySchedule: newWeekly,
          blockedDates: newBlockedDates,
        });

        // ─── CONSULTA DINÁMICA DE CITAS OCUPADAS (SUPABASE) ───
        console.log("🔄 [ReservationModal] Consultando citas ocupadas en Supabase...");
        let occupiedList: { date: string; time: string }[] = [];

        // 1. Consulta directa a tabla bookings
        const { data: directBookings, error: bErr } = await supabase
          .from("bookings")
          .select("id, start_time, status")
          .neq("status", "cancelled");

        if (!bErr && directBookings && directBookings.length > 0) {
          occupiedList = directBookings.map((b: any) => {
            const d = new Date(b.start_time);
            return {
              date: format(d, "yyyy-MM-dd"),
              time: format(d, "HH:mm"),
            };
          });
        }

        // 2. Consulta fallback si existe tabla appointments
        if (occupiedList.length === 0) {
          try {
            const { data: apptData, error: apptErr } = await supabase
              .from("appointments")
              .select("id, start_time, status")
              .neq("status", "cancelled");

            if (!apptErr && apptData && apptData.length > 0) {
              occupiedList = apptData.map((b: any) => {
                const d = new Date(b.start_time);
                return {
                  date: format(d, "yyyy-MM-dd"),
                  time: format(d, "HH:mm"),
                };
              });
            }
          } catch (e) {}
        }

        // 3. Fallback RPC
        if (occupiedList.length === 0) {
          const { data: occData } = await supabase.rpc("get_occupied_slots");
          if (occData && Array.isArray(occData)) {
            occupiedList = occData;
          }
        }

        console.log("✅ [ReservationModal] Total de horarios ocupados recibidos de Supabase:", occupiedList);
        setBookings(occupiedList);
      } catch (err) {
        console.error("❌ [ReservationModal] Error al obtener datos de reserva:", err);
      }
    };

    fetchData();
  }, [serviceIdParam, optionIdParam]);

  const handleSelectService = (s: Service) => {
    setService(s);
    setOption(s.options[0]);
  };

  const defaultTimes = ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"];

  const isTimeBooked = (dateStr: string, time: string) => {
    return bookings.some((b) => b.date === dateStr && b.time === time);
  };

  const isDayFullyBooked = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = date.getDay();
    const isInactiveDay = scheduleConfig?.weeklySchedule?.[dayOfWeek]?.active === false;
    const isBlocked = scheduleConfig?.blockedDates?.includes(dateStr);
    if (isInactiveDay || isBlocked) return false;

    const activeSlots: string[] = scheduleConfig?.weeklySchedule?.[dayOfWeek]?.slots || defaultTimes;
    if (!activeSlots || activeSlots.length === 0) return false;

    const bookedSlotsForDay = bookings.filter((b) => b.date === dateStr).map((b) => b.time);
    return activeSlots.every((slot) => bookedSlotsForDay.includes(slot));
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = date.getDay();
    const isPast = isBefore(date, startOfToday());
    const isBlocked = scheduleConfig?.blockedDates?.includes(dateStr);
    const isInactiveDay = scheduleConfig?.weeklySchedule?.[dayOfWeek]?.active === false;
    const fullyBooked = isDayFullyBooked(date);

    if (isPast || isBlocked || isInactiveDay || fullyBooked) return;

    setModalDate(date);
    setTempTime(selectedDate && isSameDay(selectedDate, date) ? selectedTime : null);
    setIsTimeModalOpen(true);
  };

  const handleConfirmTimeSelection = () => {
    if (!tempTime) {
      alert("Por favor selecciona un horario disponible.");
      return;
    }
    setSelectedDate(modalDate);
    setSelectedTime(tempTime);
    setIsTimeModalOpen(false);
  };

  const handleProceedToCheckout = () => {
    if (!selectedDate || !selectedTime) {
      alert("Por favor selecciona una fecha y un horario antes de continuar.");
      return;
    }

    if (allServices.length === 0) {
      alert("No hay servicios disponibles en este momento. Intenta más tarde.");
      return;
    }

    let activeService = service;
    if (!activeService) {
      activeService = serviceIdParam
        ? allServices.find((s) => s.id === serviceIdParam) ?? null
        : allServices[0] ?? null;
      activeService = activeService || (allServices[0] ?? null);
      setService(activeService);
    }

    let activeOption = option;
    if (!activeOption || !activeService.options.some((o) => o.id === activeOption.id)) {
      activeOption = optionIdParam
        ? activeService.options.find((o: any) => o.id === optionIdParam)
        : activeService.options[0];
      activeOption = activeOption || activeService.options[0];
      setOption(activeOption);
    }

    setStep("checkout");
  };

  const handleSubmitBooking = async () => {
    if (!name.trim()) {
      alert("Por favor ingresa tu Nombre Completo.");
      return;
    }
    if (!phone.trim()) {
      alert("Por favor ingresa tu número de Teléfono.");
      return;
    }
    if (!selectedDate || !selectedTime) {
      alert("Por favor selecciona fecha y horario válidos.");
      return;
    }

    if (allServices.length === 0) {
      alert("No hay servicios disponibles en este momento. Intenta más tarde.");
      return;
    }
    let activeService = service;
    if (!activeService) {
      activeService = serviceIdParam
        ? allServices.find((s) => s.id === serviceIdParam) ?? null
        : allServices[0] ?? null;
      activeService = activeService || (allServices[0] ?? null);
      setService(activeService);
    }
    let activeOption = option;
    if (!activeOption || !activeService.options.some((o) => o.id === activeOption.id)) {
      activeOption = optionIdParam
        ? activeService.options.find((o: any) => o.id === optionIdParam)
        : activeService.options[0];
      activeOption = activeOption || activeService.options[0];
      setOption(activeOption);
    }

    setIsSubmitting(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const [hours, minutes] = selectedTime.split(":").map(Number);

      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);

      const durationStr = option.duration || "60";
      const durationMinutes = parseInt(durationStr) || 60;
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      // ─── VALIDACIÓN ESTRICTA: PREVENCIÓN DE DOBLE AGENDAMIENTO ───
      // 1. Verificar si la fecha está en blocked_dates
      const { data: blockedCheck } = await supabase
        .from("blocked_dates")
        .select("date, reason")
        .eq("date", dateStr);

      if (blockedCheck && blockedCheck.length > 0) {
        alert(`⚠️ Fecha no disponible: Este día no está habilitado para citas (${blockedCheck[0].reason || "Día bloqueado"}). Por favor selecciona otra fecha.`);
        setIsSubmitting(false);
        setStep("select");
        return;
      }

      // 2. Verificar si el horario seleccionado ya fue tomado
      const { data: existingSlots } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("start_time", startTime.toISOString())
        .neq("status", "cancelled");

      if (existingSlots && existingSlots.length > 0) {
        alert("⚠️ Horario no disponible: Este turno acaba de ser reservado por otro cliente. Por favor selecciona otro horario.");
        const { data: occData } = await supabase.rpc("get_occupied_slots");
        if (occData) setBookings(occData);
        setIsSubmitting(false);
        setStep("select");
        return;
      }

      const fechaFormatted = format(selectedDate, "EEEE, d 'de' MMMM", { locale: es });
      const horaFormatted = formatTime12h(selectedTime);

      const bookingResponse = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: name.trim(),
          client_phone: phone.trim(),
          service_id: activeService.id,
          service_option_id: option.id,
          service_name: activeService.name,
          option_name: option.name,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: "confirmed",
          fecha: fechaFormatted,
          hora: horaFormatted,
        }),
      });

      const bookingResult = await bookingResponse.json();
      const data = bookingResult?.data;

      if (!bookingResponse.ok || !data) {
        alert("Ocurrió un error al procesar la reserva: " + (bookingResult?.error || "Error desconocido"));
        const { data: occData } = await supabase.rpc("get_occupied_slots");
        if (occData) setBookings(occData);
        return;
      }

      fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: data.id,
          clientName: name.trim(),
          serviceName: activeService.name,
          optionName: option.name,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      }).catch(console.error);

      setBookings((prev) => [...prev, { date: dateStr, time: selectedTime }]);
      setStep("confirmed");
    } catch (e) {
      console.error(e);
      alert("Error de conexión al registrar la reserva.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendWhatsAppConfirmation = () => {
    if (!selectedDate || !selectedTime || !service || !option) return;

    const dateFormatted = format(selectedDate, "EEEE, d 'de' MMMM", { locale: es });
    const message =
      `*¡Hola Milibeauty!* Quisiera confirmar mi reserva:\n\n` +
      `👤 *Cliente:* ${name}\n` +
      `📱 *Teléfono:* ${phone}\n` +
      `💅 *Servicio:* ${service.name} (${option.name})\n` +
      `📅 *Fecha:* ${dateFormatted}\n` +
      `⏰ *Hora:* ${formatTime12h(selectedTime)}\n` +
      `💵 *Total:* €${option.price.toFixed(2)}\n` +
      `💳 *Pago:* ${paymentMethod === "pagomovil" ? "Pago Móvil" : paymentMethod === "transferencia" ? "Transferencia" : "En Salón"}` +
      (referenceNumber ? `\n🔢 *Ref:* ${referenceNumber}` : "");

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const handleCloseModal = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-brand-secondary/85 backdrop-blur-2xl text-brand-tertiary w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-brand-outline/30 relative my-auto max-h-[92vh] flex flex-col">
        <div className={`sticky top-0 z-30 flex items-center justify-between shrink-0 w-full pointer-events-none ${step === "select" ? "absolute right-0 top-0 p-4 bg-transparent" : "bg-white/90 backdrop-blur-md px-5 py-4 border-b border-brand-outline/10"}`}>
          <div className="flex items-center gap-2 pointer-events-auto">
            {step === "checkout" && (
              <button
                onClick={() => setStep("select")}
                className="p-1.5 text-brand-tertiary hover:bg-brand-secondary rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {step !== "select" && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary block">
                  {step === "checkout" ? "Paso 2 de 2: Datos y Pago" : "Reserva Solicitada"}
                </span>
                <h2 className="text-xl font-serif italic text-brand-tertiary leading-tight">
                  {step === "checkout" ? "Confirmación y Pago" : "¡Cita Registrada!"}
                </h2>
              </div>
            )}
          </div>

          <button
            onClick={handleCloseModal}
            className={`p-1.5 rounded-full transition-colors pointer-events-auto ${step === "select" ? "bg-white/80 backdrop-blur-sm shadow-sm text-brand-tertiary hover:bg-white border border-brand-outline/10" : "text-brand-tertiary/60 hover:text-brand-tertiary hover:bg-brand-secondary"}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`overflow-y-auto flex-1 px-4 sm:px-6 pb-4 sm:pb-6 ${step === "select" ? "pt-2 space-y-3" : "pt-4 sm:pt-6 space-y-6"}`}>
          {step === "select" && (
            <div className="space-y-3">
              {service && (
                <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl shadow-xs border border-brand-outline/10 space-y-3">
                  <div className="flex flex-col gap-2.5 items-center text-center pt-2">
                    <img
                      src={service.imageUrl || FALLBACK_SERVICE_IMAGE}
                      alt={service.name}
                      className="w-16 h-16 rounded-2xl object-cover shadow-sm"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.src !== FALLBACK_SERVICE_IMAGE) img.src = FALLBACK_SERVICE_IMAGE;
                      }}
                    />
                    <div>
                      <p className="font-serif italic font-medium text-2xl text-brand-tertiary leading-tight">{service.name}</p>
                    </div>
                  </div>

                  {service.options && service.options.length > 0 && (() => {
                    // Filtrar opciones «Premium» cuando el modo premium está desactivado
                    // isPremiumEnabled se actualiza en tiempo real via Supabase Realtime
                    const visibleOptions = isPremiumEnabled
                      ? service.options
                      : service.options.filter(
                          (o) => !o.name.toLowerCase().includes("premium")
                        );

                    if (visibleOptions.length === 0) return null;

                    return (
                      <div className="pt-2 border-t border-brand-outline/10">
                        {!isPremiumEnabled && service.options.some((o) => o.name.toLowerCase().includes("premium")) && (
                          <p className="text-[10px] text-brand-tertiary/50 italic mb-2 text-center">
                            Solo modalidad clásica disponible
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          {visibleOptions.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => setOption(opt)}
                              className={`p-2.5 rounded-xl text-left border transition-all duration-200 flex justify-between items-center ${
                                option?.id === opt.id
                                  ? "bg-brand-primary/5 border-brand-primary shadow-2xs ring-1 ring-brand-primary"
                                  : "bg-white border-brand-outline/10 text-brand-tertiary/70 hover:border-brand-primary/40"
                              }`}
                            >
                              <div>
                                <span className="block font-bold text-xs text-brand-tertiary">{opt.name}</span>
                                <span className="text-[10px] text-brand-tertiary/60">⏱️ {opt.duration || "60 min"}</span>
                              </div>
                              <span className="font-bold text-sm text-brand-primary">€${opt.price}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <section className="bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-brand-outline/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-tertiary/70 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-brand-primary stroke-[1.5]" /> Selección de Fecha
                  </h3>
                  {selectedDate && selectedTime && (
                    <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50/80 px-3 py-1 rounded-full border border-emerald-200">
                      {format(selectedDate, "dd/MM")} - {formatTime12h(selectedTime)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-[150px] overflow-y-auto pr-1 snap-y scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-brand-outline/20 [&::-webkit-scrollbar-thumb]:rounded-full pb-2">
                  {Array.from({ length: 45 }, (_, i) => addDays(startOfToday(), i)).map((date, idx) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const dayOfWeek = date.getDay();
                    const isToday = isSameDay(date, new Date());
                    const isSelected = selectedDate ? isSameDay(selectedDate, date) : false;

                    const isBlocked = scheduleConfig?.blockedDates?.includes(dateStr);
                    const isInactiveDay = scheduleConfig?.weeklySchedule?.[dayOfWeek]?.active === false;
                    const fullyBooked = isDayFullyBooked(date);

                    if (isBlocked || isInactiveDay) return null;

                    const isDisabled = fullyBooked;

                    return (
                      <button
                        key={idx}
                        disabled={isDisabled}
                        onClick={() => handleDateClick(date)}
                        className={`relative h-[4.25rem] flex-shrink-0 snap-start rounded-2xl flex flex-col items-center justify-center p-1 transition-all duration-200 ${
                          isSelected
                            ? "bg-brand-tertiary text-white shadow-md font-semibold ring-2 ring-brand-primary"
                            : fullyBooked
                            ? "bg-rose-50/50 text-rose-300 border border-rose-100 cursor-not-allowed opacity-75"
                            : "bg-white border border-brand-outline/20 shadow-sm hover:bg-brand-primary/5 hover:border-brand-primary/40 text-brand-tertiary"
                        }`}
                      >
                        <span className={`text-[8px] font-semibold uppercase tracking-widest mb-0.5 ${isSelected ? "text-brand-primary-light/90" : "text-brand-tertiary/50"}`}>
                          {format(date, "EEE", { locale: es })}
                        </span>
                        <span className={`text-lg font-medium leading-none ${isSelected ? "text-white" : fullyBooked ? "text-rose-400 line-through" : ""}`}>
                          {format(date, "d")}
                        </span>
                        <span className={`text-[9px] capitalize mt-0.5 ${isSelected ? "text-white/70" : "text-brand-tertiary/50"}`}>
                          {format(date, "MMM", { locale: es })}
                        </span>

                        {isToday && !isSelected && !fullyBooked && (
                          <span className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-brand-primary shadow-xs" />
                        )}
                        {fullyBooked && (
                          <span className="absolute bottom-1 text-[5.5px] font-semibold text-rose-500 uppercase tracking-tight leading-none">Lleno</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedDate && selectedTime && (
                  <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 rounded-2xl flex items-center justify-between animate-in fade-in">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 block">Turno Seleccionado:</span>
                      <p className="font-serif italic text-sm font-normal text-emerald-950 capitalize">
                        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                      <p className="text-xs font-medium text-emerald-800 mt-0.5">⏰ {formatTime12h(selectedTime)}</p>
                    </div>
                    <button
                      onClick={() => handleDateClick(selectedDate)}
                      className="px-3.5 py-1.5 bg-white text-emerald-900 text-xs font-medium rounded-xl border border-emerald-300 shadow-2xs hover:bg-emerald-100 transition-colors"
                    >
                      Cambiar Hora
                    </button>
                  </div>
                )}
              </section>

              <div>
                <button
                  onClick={handleProceedToCheckout}
                  disabled={!selectedDate || !selectedTime}
                  className="w-full bg-brand-primary hover:bg-brand-primary-light text-white py-3.5 rounded-2xl font-bold text-sm uppercase tracking-[0.2em] flex justify-center items-center gap-2 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-md active:scale-[0.98]"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-5 h-5 stroke-[2]" />
                </button>
              </div>
            </div>
          )}

          {step === "checkout" && (
            <div className="space-y-5">
              <section className="bg-white p-5 rounded-3xl border border-brand-outline/20 space-y-3">
                <div className="flex items-center justify-between border-b border-brand-outline/15 pb-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-primary">Resumen de Cita</span>
                  <button
                    onClick={() => setStep("select")}
                    className="text-xs text-brand-tertiary underline font-medium hover:text-brand-primary transition-colors"
                  >
                    Modificar
                  </button>
                </div>

                <div className="flex items-center gap-3.5">
                  {service && (
                    <img
                        src={service.imageUrl || FALLBACK_SERVICE_IMAGE}
                        alt={service.name}
                        className="w-14 h-14 rounded-2xl object-cover shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.src !== FALLBACK_SERVICE_IMAGE) img.src = FALLBACK_SERVICE_IMAGE;
                        }}
                      />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-serif italic font-normal text-lg text-brand-tertiary leading-tight">{service?.name}</h4>
                    <p className="text-xs font-semibold text-brand-tertiary/70 mt-0.5">{option?.name} (€${option?.price})</p>
                    <p className="text-xs text-emerald-800 font-medium mt-0.5 capitalize">
                      📅 {selectedDate && format(selectedDate, "EEEE d 'de' MMMM", { locale: es })} - {formatTime12h(selectedTime)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-white p-5 rounded-3xl border border-brand-outline/20 space-y-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-tertiary">
                  <User className="w-4 h-4 text-brand-primary stroke-[1.5]" /> Tus Datos Personales
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold tracking-widest uppercase mb-1.5 text-brand-tertiary/70">Nombre Completo *</label>
                    <input
                      type="text"
                      placeholder="Ej. Camila Silva"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-brand-secondary/60 p-3.5 rounded-2xl border border-brand-outline/20 focus:border-brand-primary focus:bg-white outline-none transition-all text-xs font-light text-brand-tertiary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold tracking-widest uppercase mb-1.5 text-brand-tertiary/70">Teléfono WhatsApp *</label>
                    <input
                      type="tel"
                      placeholder="+58 412 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-brand-secondary/60 p-3.5 rounded-2xl border border-brand-outline/20 focus:border-brand-primary focus:bg-white outline-none transition-all text-xs font-light text-brand-tertiary"
                    />
                  </div>
                </div>
              </section>

              <section className="bg-white/60 backdrop-blur-md p-4 rounded-2xl shadow-xs border border-brand-outline/10 space-y-3">
                <div
                  onClick={() => setIsPaymentExpanded(!isPaymentExpanded)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-brand-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-tertiary">Método de Pago</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-secondary text-brand-tertiary border border-brand-outline/10">
                      {paymentMethod === "pagomovil" && "Pago Móvil"}
                      {paymentMethod === "transferencia" && "Transferencia"}
                      {paymentMethod === "store" && "En Salón"}
                    </span>
                    <button type="button" className="p-1 text-brand-tertiary/60">
                      {isPaymentExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isPaymentExpanded && (
                  <div className="pt-2 border-t border-brand-outline/10 space-y-3">
                    <div className="space-y-2">
                      <label onClick={() => setPaymentMethod("pagomovil")} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-colors ${paymentMethod === "pagomovil" ? "border-brand-primary bg-brand-primary/5" : "border-brand-outline/10"}`}>
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center mr-2.5 ${paymentMethod === "pagomovil" ? "border-brand-primary" : "border-brand-outline/40"}`}>
                          {paymentMethod === "pagomovil" && <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />}
                        </div>
                        <div className="flex-1">
                          <span className="block font-bold text-xs text-brand-tertiary">Pago Móvil</span>
                          <span className="text-[10px] text-brand-tertiary/60">Banesco / Mercantil</span>
                        </div>
                        <Smartphone className="w-4 h-4 text-brand-tertiary/50" />
                      </label>

                      <label onClick={() => setPaymentMethod("transferencia")} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-colors ${paymentMethod === "transferencia" ? "border-brand-primary bg-brand-primary/5" : "border-brand-outline/10"}`}>
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center mr-2.5 ${paymentMethod === "transferencia" ? "border-brand-primary" : "border-brand-outline/40"}`}>
                          {paymentMethod === "transferencia" && <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />}
                        </div>
                        <div className="flex-1">
                          <span className="block font-bold text-xs text-brand-tertiary">Transferencia Bancaria</span>
                          <span className="text-[10px] text-brand-tertiary/60">Cuentas Nacionales</span>
                        </div>
                        <Building2 className="w-4 h-4 text-brand-tertiary/50" />
                      </label>

                      <label onClick={() => setPaymentMethod("store")} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-colors ${paymentMethod === "store" ? "border-brand-primary bg-brand-primary/5" : "border-brand-outline/10"}`}>
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center mr-2.5 ${paymentMethod === "store" ? "border-brand-primary" : "border-brand-outline/40"}`}>
                          {paymentMethod === "store" && <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />}
                        </div>
                        <div className="flex-1">
                          <span className="block font-bold text-xs text-brand-tertiary">Pagar en el Salón</span>
                          <span className="text-[10px] text-brand-tertiary/60">Efectivo, Divisas o Punto de Venta</span>
                        </div>
                        <Banknote className="w-4 h-4 text-brand-tertiary/50" />
                      </label>
                    </div>

                    {(paymentMethod === "pagomovil" || paymentMethod === "transferencia") && (
                      <div className="p-3 bg-brand-secondary/40 rounded-xl border border-brand-outline/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-[11px] uppercase tracking-wider text-brand-primary">
                            Datos para {paymentMethod === "pagomovil" ? "Pago Móvil" : "Transferencia"}:
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                `Banco: ${siteConfig.bankName || "Banesco (0134)"}\nCI/RIF: ${siteConfig.bankId || "V-26123456"}\nTeléfono: ${siteConfig.bankPhone || "0412-1234567"}\nTitular: ${siteConfig.bankOwner || "Milibeauty C.A."}`,
                                "all"
                              )
                            }
                            className="flex items-center gap-1 px-2 py-0.5 bg-white border border-brand-outline/20 rounded-lg text-[9px] font-bold text-brand-tertiary hover:bg-brand-primary hover:text-white transition-colors"
                          >
                            {copiedField === "all" ? (
                              <span className="text-emerald-600 font-bold">¡Copiados!</span>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-brand-primary" />
                                <span>Copiar Datos</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-brand-tertiary text-[11px]">
                          <div className="p-1.5 bg-white rounded-lg border border-brand-outline/10">
                            <span className="text-[9px] text-brand-tertiary/50 block font-semibold uppercase">Banco</span>
                            <span className="font-bold">{siteConfig.bankName || "Banesco (0134)"}</span>
                          </div>
                          <div className="p-1.5 bg-white rounded-lg border border-brand-outline/10">
                            <span className="text-[9px] text-brand-tertiary/50 block font-semibold uppercase">CI / RIF</span>
                            <span className="font-bold">{siteConfig.bankId || "V-26123456"}</span>
                          </div>
                          <div className="p-1.5 bg-white rounded-lg border border-brand-outline/10">
                            <span className="text-[9px] text-brand-tertiary/50 block font-semibold uppercase">Teléfono</span>
                            <span className="font-bold">{siteConfig.bankPhone || "0412-1234567"}</span>
                          </div>
                          <div className="p-1.5 bg-white rounded-lg border border-brand-outline/10">
                            <span className="text-[9px] text-brand-tertiary/50 block font-semibold uppercase">Titular</span>
                            <span className="font-bold">{siteConfig.bankOwner || "Milibeauty C.A."}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-brand-outline/10">
                          <label className="block text-[9px] font-bold tracking-widest uppercase mb-1 text-brand-tertiary/80">
                            Nº de Referencia (Opcional)
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. 123456"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            className="w-full bg-white p-2 rounded-lg border border-brand-outline/20 outline-none text-xs focus:border-brand-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <button
                onClick={handleSubmitBooking}
                disabled={isSubmitting}
                className="w-full bg-brand-primary text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Procesando Reserva..." : `Confirmar Reserva (€${option?.price?.toFixed(2)})`}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === "confirmed" && (
            <div className="space-y-5 animate-in fade-in">
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-brand-outline/10 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <Check className="w-7 h-7" />
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    ¡Reserva Solicitada con Éxito!
                  </span>
                  <h3 className="text-xl font-serif italic text-brand-tertiary mt-2">Gracias, {name}</h3>
                  <p className="text-xs text-brand-tertiary/70 mt-0.5 max-w-xs mx-auto">
                    Hemos registrado tu cita en Milibeauty.
                  </p>
                </div>

                <div className="bg-brand-secondary/40 p-4 rounded-xl border border-brand-outline/10 text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center border-b border-brand-outline/10 pb-1.5">
                    <span className="text-[10px] font-bold uppercase text-brand-tertiary/50">Servicio</span>
                    <span className="font-serif italic font-medium text-brand-tertiary">{service?.name}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-brand-outline/10 pb-1.5">
                    <span className="text-[10px] font-bold uppercase text-brand-tertiary/50">Modalidad</span>
                    <span className="font-bold text-xs text-brand-tertiary">{option?.name}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-brand-outline/10 pb-1.5">
                    <span className="text-[10px] font-bold uppercase text-brand-tertiary/50">Fecha y Hora</span>
                    <span className="font-bold text-xs text-emerald-700 capitalize">
                      {selectedDate && format(selectedDate, "EEE d 'de' MMM", { locale: es })} - {formatTime12h(selectedTime)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-brand-outline/10 pb-1.5">
                    <span className="text-[10px] font-bold uppercase text-brand-tertiary/50">Método de Pago</span>
                    <span className="font-bold text-xs text-brand-tertiary">
                      {paymentMethod === "pagomovil" ? "Pago Móvil" : paymentMethod === "transferencia" ? "Transferencia" : "En Salón"}
                    </span>
                  </div>
                  {referenceNumber && (
                    <div className="flex justify-between items-center border-b border-brand-outline/10 pb-1.5">
                      <span className="text-[10px] font-bold uppercase text-brand-tertiary/50">Ref. Pago</span>
                      <span className="font-mono font-bold text-xs text-brand-tertiary">{referenceNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-bold uppercase text-brand-tertiary">Total</span>
                    <span className="font-bold text-base text-brand-primary">€${option?.price?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={sendWhatsAppConfirmation}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Confirmar por WhatsApp</span>
                  </button>

                  <button
                    onClick={() => setIsLocationOpen(true)}
                    className="w-full bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 py-3 rounded-2xl font-medium text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-brand-primary/20"
                  >
                    <MapPin className="w-4 h-4 stroke-[1.75]" />
                    <span>¿Cómo Llegar al Studio?</span>
                  </button>

                  <button
                    onClick={handleCloseModal}
                    className="w-full bg-brand-secondary text-brand-tertiary py-2.5 rounded-2xl font-medium text-xs uppercase tracking-wider hover:bg-brand-secondary-dark transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {isTimeModalOpen && modalDate && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl border border-brand-outline/10 space-y-4 animate-in slide-in-from-bottom-5">
              <div className="flex items-center justify-between border-b border-brand-outline/10 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary block">
                    Horarios Disponibles
                  </span>
                  <h4 className="font-serif italic text-base font-medium text-brand-tertiary capitalize mt-0.5">
                    {format(modalDate, "EEEE d 'de' MMMM", { locale: es })}
                  </h4>
                </div>
                <button
                  onClick={() => setIsTimeModalOpen(false)}
                  className="p-1.5 text-brand-tertiary/50 hover:text-brand-tertiary rounded-full hover:bg-brand-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {(() => {
                const dayOfWeek = modalDate.getDay();
                const dateStr = format(modalDate, "yyyy-MM-dd");
                const isBlocked = scheduleConfig?.blockedDates?.includes(dateStr);
                const isInactiveDay = scheduleConfig?.weeklySchedule?.[dayOfWeek]?.active === false;

                if (isBlocked || isInactiveDay) {
                  return (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-center text-xs text-red-600">
                      Este día no tiene horarios disponibles.
                    </div>
                  );
                }

                const activeSlots: string[] = scheduleConfig?.weeklySchedule?.[dayOfWeek]?.slots || defaultTimes;

                // ── FILTRADO ESTRICTO: REMOVER HORARIOS OCUPADOS ──
                const availableSlots = activeSlots.filter((time) => !isTimeBooked(dateStr, time));

                if (activeSlots.length === 0 || availableSlots.length === 0) {
                  return (
                    <div className="p-4 bg-rose-50/90 border border-rose-200/80 rounded-2xl text-center space-y-1 my-2">
                      <p className="text-xs font-bold text-rose-700">Todos los turnos de este día están ocupados</p>
                      <p className="text-[11px] text-rose-600/80">Por favor selecciona otra fecha disponible en el calendario.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-brand-tertiary/80">Turnos disponibles ({availableSlots.length}):</p>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {activeSlots.length - availableSlots.length} ocupado(s)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {availableSlots.map((time) => {
                        const isSelected = tempTime === time;

                        return (
                          <button
                            key={time}
                            onClick={() => setTempTime(time)}
                            className={`py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                              isSelected
                                ? "bg-brand-tertiary text-white border-brand-tertiary shadow-xs ring-2 ring-brand-primary"
                                : "bg-brand-secondary/60 border-brand-outline/10 text-brand-tertiary hover:border-brand-primary/50 hover:bg-white"
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5 opacity-70" />
                            <span>{formatTime12h(time)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="pt-1 flex gap-2">
                <button
                  onClick={() => setIsTimeModalOpen(false)}
                  className="flex-1 py-2.5 bg-brand-secondary text-brand-tertiary rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-brand-secondary-dark"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmTimeSelection}
                  disabled={!tempTime}
                  className="flex-1 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-brand-primary/90 disabled:opacity-40"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        <LocationModal
          isOpen={isLocationOpen}
          onClose={() => setIsLocationOpen(false)}
          studioName={siteConfig.studioName}
          studioAddress={siteConfig.studioAddress}
          mapsUrl={siteConfig.mapsUrl}
        />
      </div>
    </div>
  );
}