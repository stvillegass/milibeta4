"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Service } from "@/types";
import ReservationModal from "@/components/ReservationModal";
import ServiceVectorHeader from "@/components/ServiceVectorHeader";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

function ServicesContent() {
  const [services, setServices] = useState<Service[]>([]);
  const [isPremiumEnabled, setIsPremiumEnabled] = useState(true);
  const searchParams = useSearchParams();

  const initialCategory = searchParams.get("category") || "nails";
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [selectedForBooking, setSelectedForBooking] = useState<{ serviceId: string; optionId: string } | null>(null);

  // ── Sincronizar estado premium desde Supabase Realtime ──────────────
  useEffect(() => {
    // 1. Obtener el valor inicial
    const fetchInitial = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "premium_enabled")
        .single();

      if (data) {
        setIsPremiumEnabled(data.value === true || data.value === "true");
      }
    };
    fetchInitial();

    // 2. Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel("app_settings_realtime_services")
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
          setIsPremiumEnabled(raw === true || raw === "true");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) {
      setActiveCategory(cat);
    }
    const serviceParam = searchParams.get("service");
    const optionParam = searchParams.get("option");
    if (serviceParam) {
      setSelectedForBooking({ serviceId: serviceParam, optionId: optionParam || "" });
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadServices = async () => {
      try {
        const { data, error } = await supabase
          .from("services")
          .select("*, service_options(*)")
          .order("order_index", { ascending: true });

        if (error) {
          console.error("Error fetching services:", error);
          if (!cancelled) setServices([]);
          return;
        }

        const mapped: Service[] = (data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
          imageUrl: s.image_url,
          order: s.order_index,
          isPremium: s.is_premium,
          options: (s.service_options || []).map((o: any) => ({
            id: o.id,
            name: o.name,
            price: Number(o.price),
            duration: o.duration_minutes ? `${o.duration_minutes} min` : "60 min",
            isPremium: o.name.toLowerCase().includes("premium"),
          })),
        }));

        const filtered = mapped.filter((s: Service) => s.category === activeCategory);
        if (!cancelled) setServices(filtered);
      } catch (err) {
        console.error("Error loading services:", err);
        if (!cancelled) setServices([]);
      }
    };

    loadServices();

    return () => {
      cancelled = true;
    };
  }, [activeCategory]);

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    window.history.replaceState(null, "", `/services?category=${category}`);
  };

  return (
    <div className="pt-24 sm:pt-28 px-4 sm:px-6 lg:px-8 pb-16 min-h-screen max-w-6xl lg:max-w-7xl mx-auto space-y-8">
      <div className="max-w-md mx-auto grid grid-cols-2 gap-2 p-1.5 bg-brand-secondary-dark/80 rounded-2xl border border-brand-outline/20 shadow-2xs">
        <button
          onClick={() => handleCategoryChange("nails")}
          className={`py-2.5 px-3 rounded-xl text-xs font-medium tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeCategory === "nails"
              ? "bg-brand-tertiary text-white shadow-xs font-semibold"
              : "text-brand-tertiary/60 hover:text-brand-tertiary"
          }`}
        >
          <span>Uñas</span>
        </button>
        <button
          onClick={() => handleCategoryChange("lashes")}
          className={`py-2.5 px-3 rounded-xl text-xs font-medium tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1.5 border-2 border-brand-primary shadow-xs ${
            activeCategory === "lashes"
              ? "bg-brand-tertiary text-white font-semibold"
              : "bg-brand-primary/10 text-brand-tertiary font-semibold hover:bg-brand-primary/20"
          }`}
        >
          <span>Cejas & Pestañas</span>
        </button>
      </div>

      <div>
        {services.length === 0 ? (
          <div className="text-center py-16 text-brand-tertiary/40 text-sm font-light tracking-wide">
            No hay servicios disponibles en esta categoría.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services
              .sort((a, b) => a.order - b.order)
              .map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  isPremiumEnabled={isPremiumEnabled}
                  onReserve={(serviceId, optionId) => setSelectedForBooking({ serviceId, optionId })}
                />
              ))}
          </div>
        )}
      </div>

      {selectedForBooking && (
        <ReservationModal
          isOpen={true}
          onClose={() => setSelectedForBooking(null)}
          initialServiceId={selectedForBooking.serviceId}
          initialOptionId={selectedForBooking.optionId}
        />
      )}
    </div>
  );
}

function ServiceCard({
  service,
  isPremiumEnabled,
  onReserve,
}: {
  service: Service;
  isPremiumEnabled: boolean;
  onReserve: (serviceId: string, optionId: string) => void;
}) {
  const [selectedOption, setSelectedOption] = useState(service.options[0]);

  useEffect(() => {
    if (service.options && service.options.length > 0) {
      // Si la primera opción es premium y el modo premium está desactivado,
      // selecciona la primera opción no premium disponible
      const firstVisible = isPremiumEnabled
        ? service.options[0]
        : service.options.find((o) => !o.isPremium) || service.options[0];
      setSelectedOption(firstVisible);
    }
  }, [service, isPremiumEnabled]);

  const hasPremiumModalidad = service.options.some((o) => o.isPremium);
  const hasVisibleOption = isPremiumEnabled || service.options.some((o) => !o.isPremium);

  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-brand-outline/20 hover:border-brand-primary/30 transition-all duration-300">
      {service.imageUrl ? (
        <div className="h-44 relative overflow-hidden bg-brand-secondary-dark border-b border-brand-outline/10">
          <Image
            src={service.imageUrl}
            alt={service.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            quality={90}
            className="w-full h-full object-cover"
          />
          {selectedOption?.duration && (
            <div className="absolute top-3.5 right-3.5 bg-[#1C1917]/85 backdrop-blur-md text-brand-primary border border-brand-primary/30 text-[10px] font-medium tracking-wider px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
              <span className="text-[11px]">⏱</span>
              <span>{selectedOption.duration}</span>
            </div>
          )}
        </div>
      ) : (
        <ServiceVectorHeader
          category={service.category}
          name={service.name}
          duration={selectedOption.duration || "60 min"}
        />
      )}

      <div className="p-6 space-y-4">
        {(() => {
          const displayName = service.name.replace(/manicura\s*/gi, "").trim() || service.name;
          const titleFontSize =
            displayName.length > 22
              ? "text-base sm:text-lg"
              : displayName.length > 16
              ? "text-lg sm:text-xl"
              : "text-xl sm:text-2xl";

          return (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3
                  className={`${titleFontSize} font-serif italic font-normal text-brand-tertiary tracking-tight truncate whitespace-nowrap`}
                  title={displayName}
                >
                  {displayName}
                </h3>
              </div>
              <div className="text-right shrink-0">
                <span className="text-base font-semibold text-brand-primary block tracking-tight">
                  €${selectedOption.price.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })()}

        {service.options.length > 1 && (
          <div className="space-y-1.5">
            {!isPremiumEnabled && hasPremiumModalidad && service.options.some((o) => !o.isPremium) && (
              <p className="text-[10px] text-brand-tertiary/50 italic">
                🔒 La modalidad Premium está bloqueada – solo modalidades clásicas disponibles
              </p>
            )}
            <div className="grid grid-cols-2 gap-1.5 bg-brand-secondary-dark/70 p-1 rounded-2xl border border-brand-outline/20">
              {service.options.map((option) => {
                const isPremium = !!option.isPremium;
                const isBlocked = !isPremiumEnabled && isPremium;
                const isActive = selectedOption.id === option.id;

                if (isBlocked) {
                  return (
                    <div
                      key={option.id}
                      className="relative py-2.5 px-3 text-xs font-medium rounded-xl flex items-center justify-center gap-2 bg-brand-secondary/50 text-brand-tertiary/40 border border-dashed border-brand-outline/20 cursor-not-allowed select-none"
                      title="Modalidad Premium bloqueada"
                    >
                      <span className="w-2 h-2 rounded-full bg-brand-tertiary/20 shrink-0" />
                      <span className="line-through decoration-brand-outline/50">{option.name}</span>
                      <svg
                        className="w-3 h-3 text-brand-primary/60 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                  );
                }

                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedOption(option)}
                    type="button"
                    className={`py-2.5 px-3 text-xs font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                      isActive
                        ? "bg-brand-tertiary text-white shadow-xs font-semibold"
                        : "text-brand-tertiary/75 hover:text-brand-tertiary bg-transparent"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full transition-all duration-200 shrink-0 ${
                        isActive ? "bg-brand-primary scale-110 ring-2 ring-brand-primary/30" : "bg-brand-tertiary/40"
                      }`}
                    />
                    <span>{option.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-1">
          <button
            onClick={() => onReserve(service.id, selectedOption.id)}
            disabled={!hasVisibleOption}
            className="w-full py-3.5 px-6 bg-brand-primary hover:bg-brand-primary-light text-white font-medium rounded-2xl text-xs uppercase tracking-widest transition-all duration-300 shadow-xs active:scale-[0.98] text-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-primary"
          >
            Reservar mi cita
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="pt-24 text-center">Cargando...</div>}>
      <ServicesContent />
    </Suspense>
  );
}
