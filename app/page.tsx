"use client";

import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  // Sin imagen por defecto hardcodeada: la portada se obtiene de forma dinámica
  // desde la API/Supabase para evitar el parpadeo ("flash") de una imagen estática.
  const [categoryImages, setCategoryImages] = useState<{
    nails: string;
    lashes: string;
  } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const [siteConfig, setSiteConfig] = useState({
    studioName: "Milibeauty",
    studioSubtitle:
      "Estudio de lujo especializado en el cuidado y diseño de tus manos y mirada.",
    nailsTag: "Especialidad",
    nailsTitle: "Manicure & Pedicure",
    nailsDescription: "Manicura, pedicura y cuidado de uñas",
    lashesTag: "Especialidad",
    lashesTitle: "Cejas y Pestañas",
    lashesDescription: "Lifting, diseño y realce de mirada",
    badge1: "Productos Premium",
    badge2: "Citas Flexibles",
    badge3: "Higiene Estricta",
    studioAddress:
      "Av. Principal Las Mercedes, Edificio Centro Empresarial, Piso 3, Local 302",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Milibeauty+Studio",
  });

  // Añade una marca de actualización (cache-buster) a la URL de la imagen. Así el
  // navegador y el optimizador de Next.js sirven siempre la última portada y la
  // actualización del panel se refleja al instante, sin servir caché vieja.
  const cacheBust = (url: string) => {
    if (!url) return url;
    const sep = url.includes("?") ? "&" : "?";
    const v = updatedAt ? `updated=${updatedAt}` : `v=${Date.now()}`;
    return `${url}${sep}${v}`;
  };

  useEffect(() => {
    let cancelled = false;

    // Sin caché: siempre traer la portada actual desde la API/Supabase
    fetch("/api/categories/images", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.nails || data?.lashes) {
          setCategoryImages({ nails: data.nails, lashes: data.lashes });
        }
        if (typeof data?.updatedAt === "number" && data.updatedAt > 0) {
          setUpdatedAt(data.updatedAt);
        }
      })
      .catch(console.error);

    fetch("/api/site-config", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data) {
          setSiteConfig((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  // Placeholder neutro mientras llega la portada real (evita mostrar la imagen por defecto)
  const coverPlaceholder = (
    <div className="absolute inset-0 bg-gradient-to-br from-stone-700 via-stone-800 to-stone-900" />
  );

  return (
    <div className="pt-20 sm:pt-28 min-h-screen px-4 sm:px-6 lg:px-8 max-w-6xl lg:max-w-7xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        <Link
          href="/services?category=nails"
          className="block relative h-72 sm:h-80 lg:h-[420px] rounded-3xl overflow-hidden group transition-all duration-500 border border-brand-outline/20 hover:border-brand-primary/50 hover:shadow-2xl active:scale-[0.99]"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/35 to-transparent z-10" />
          {categoryImages ? (
            <Image
              key={cacheBust(categoryImages.nails)}
              src={cacheBust(categoryImages.nails)}
              alt="Manicura"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={90}
              priority
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
          ) : (
            coverPlaceholder
          )}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-10 z-20 flex justify-between items-end">
            <div className="min-w-0 flex-1 mr-4">
              <span className="text-xs font-semibold text-brand-primary uppercase tracking-widest mb-1.5 block">
                {siteConfig.nailsTag}
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium text-white tracking-wide drop-shadow-md">
                {siteConfig.nailsTitle}
              </h2>
              <p className="text-xs sm:text-sm lg:text-base text-white/90 mt-2 font-light hidden sm:block">
                {siteConfig.nailsDescription}
              </p>
            </div>
            <div className="text-white/90 group-hover:text-white group-hover:translate-x-2 transition-all duration-300 shrink-0 bg-white/15 backdrop-blur-md p-3.5 sm:p-4 rounded-full border border-white/30 shadow-lg">
              <ArrowRight className="w-6 h-6 stroke-[2]" />
            </div>
          </div>
        </Link>

        <Link
          href="/services?category=lashes"
          className="block relative h-72 sm:h-80 lg:h-[420px] rounded-3xl overflow-hidden group transition-all duration-500 border border-brand-outline/20 hover:border-brand-primary/50 hover:shadow-2xl active:scale-[0.99]"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/35 to-transparent z-10" />
          {categoryImages ? (
            <Image
              key={cacheBust(categoryImages.lashes)}
              src={cacheBust(categoryImages.lashes)}
              alt="Cejas y Pestañas"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={90}
              priority
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
          ) : (
            coverPlaceholder
          )}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-10 z-20 flex justify-between items-end">
            <div className="min-w-0 flex-1 mr-4">
              <span className="text-xs font-semibold text-brand-primary uppercase tracking-widest mb-1.5 block">
                {siteConfig.lashesTag}
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium text-white tracking-wide drop-shadow-md">
                {siteConfig.lashesTitle}
              </h2>
              <p className="text-xs sm:text-sm lg:text-base text-white/90 mt-2 font-light hidden sm:block">
                {siteConfig.lashesDescription}
              </p>
            </div>
            <div className="text-white/90 group-hover:text-white group-hover:translate-x-2 transition-all duration-300 shrink-0 bg-white/15 backdrop-blur-md p-3.5 sm:p-4 rounded-full border border-white/30 shadow-lg">
              <ArrowRight className="w-6 h-6 stroke-[2]" />
            </div>
          </div>
        </Link>
      </div>

      <footer className="text-center py-10 text-xs text-brand-tertiary/40 tracking-wider">
        <p>© 2026 MILIBEAUTY LUXURY STUDIO</p>
        <div className="flex justify-center gap-6 mt-3 text-brand-tertiary/60 font-light">
          <a href="#" className="hover:text-brand-primary transition-colors">
            Privacidad
          </a>
          <a href="#" className="hover:text-brand-primary transition-colors">
            Términos
          </a>
          <a href="#" className="hover:text-brand-primary transition-colors">
            Contacto
          </a>
        </div>
      </footer>
    </div>
  );
}