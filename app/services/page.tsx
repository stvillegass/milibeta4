"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Service } from "@/types";
import ReservationModal from "@/components/ReservationModal";
import ServiceVectorHeader from "@/components/ServiceVectorHeader";
import { supabase } from "@/lib/supabase";

function ServicesContent() {
  const [services, setServices] = useState<Service[]>([]);
  const searchParams = useSearchParams();

  const initialCategory = searchParams.get("category") || "nails";
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [selectedForBooking, setSelectedForBooking] = useState<{ serviceId: string; optionId: string } | null>(null);

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
          options: (s.service_options || []).map((o: any) => ({
            id: o.id,
            name: o.name,
            price: Number(o.price),
            duration: o.duration_minutes ? `${o.duration_minutes} min` : "60 min",
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

function ServiceCard({ service, onReserve }: { service: Service; onReserve: (serviceId: string, optionId: string) => void }) {
  const [selectedOption, setSelectedOption] = useState(service.options[0]);

  useEffect(() => {
    if (service.options && service.options.length > 0) {
      setSelectedOption(service.options[0]);
    }
  }, [service]);

  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-brand-outline/20 hover:border-brand-primary/30 transition-all duration-300">
      <ServiceVectorHeader
        category={service.category}
        name={service.name}
        duration={selectedOption.duration || "60 min"}
      />

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
                  ${selectedOption.price.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })()}

        {service.options.length > 1 && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5 bg-brand-secondary-dark/70 p-1 rounded-2xl border border-brand-outline/20">
              {service.options.map((option) => {
                const isActive = selectedOption.id === option.id;
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
            className="w-full py-3.5 px-6 bg-brand-primary hover:bg-brand-primary-light text-white font-medium rounded-2xl text-xs uppercase tracking-widest transition-all duration-300 shadow-xs active:scale-[0.98] text-center"
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