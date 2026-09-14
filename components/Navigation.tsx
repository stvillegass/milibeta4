"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "framer-motion";
import { HomeIcon, BookOpen, UserCircle, MapPin } from "lucide-react";
import LocationModal from "./LocationModal";
import { useAuth } from "@/lib/AuthProvider";

function NailPolishIcon({ className = "w-5 h-5 stroke-[1.5]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2h4a1 1 0 0 1 1 1v4H9V3a1 1 0 0 1 1-1z" />
      <path d="M8 7h8a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2z" />
      <path d="M9 14c1.5 1 4.5 1 6 0" />
      <circle cx="12" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

export default function Navigation() {
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const isAdminRoute = pathname.startsWith("/admin");

  // ── Acceso oculto al panel admin desde el logo ─────────────────
  // Timestamps de clics/taps consecutivos para detectar triple clic
  const clickTimes = useRef<number[]>([]);
  // Timer de pulsación larga (long press)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag para indicar que el long press ya redirigió al admin
  const longPressTriggered = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    clearLongPressTimer();
    longPressTriggered.current = false;
    // Mantener presionado 1.5s → redirigir a /admin
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      clickTimes.current = [];
      router.push("/admin");
    }, 1500);
  };

  const cancelLongPress = () => {
    clearLongPressTimer();
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Si el long press ya activó la redirección, no navegar a "/"
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      e.preventDefault();
      return;
    }

    const now = Date.now();
    // Mantener solo los clics ocurridos en los últimos 500ms (ventana deslizante)
    clickTimes.current = clickTimes.current.filter((t) => now - t <= 500);
    clickTimes.current.push(now);

    // 3 clics rápidos consecutivos → redirigir al panel admin
    if (clickTimes.current.length >= 3) {
      clickTimes.current = [];
      e.preventDefault();
      router.push("/admin");
    }
  };

  const { scrollY } = useScroll();
  const rawScale = useTransform(scrollY, [0, 120], [1, 0.92]);
  const scale = useSpring(rawScale, { stiffness: 400, damping: 30, mass: 0.5 });

  if (isAdminRoute) return null;

  return (
    <>
      {/* ── DESKTOP & TOP HEADER ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/70 backdrop-blur-2xl border-b border-white/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03),_inset_0_1px_1px_rgba(255,255,255,0.8)] transition-all gpu-layer">
        <div className="max-w-6xl lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link
            href="/"
            onClick={handleLogoClick}
            onMouseDown={startLongPress}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onTouchStart={startLongPress}
            onTouchEnd={cancelLongPress}
            onTouchMove={cancelLongPress}
            onTouchCancel={cancelLongPress}
            className="font-serif italic text-2xl sm:text-3xl tracking-tight text-brand-tertiary hover:opacity-80 transition-opacity ml-1 select-none cursor-pointer inline-block"
            aria-label="Milibeauty, ir al inicio"
            title="Milibeauty"
          >
            Milibeauty
          </Link>

          <nav aria-label="Navegación de escritorio" className="hidden md:flex items-center gap-1.5 bg-brand-secondary/60 backdrop-blur-xl p-1.5 rounded-2xl border border-brand-outline/25 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
            <DesktopNavItem href="/" icon={<HomeIcon className="w-4 h-4 stroke-[1.75]" />} label="Inicio" active={pathname === "/"} />
            <DesktopNavItem href="/services" icon={<NailPolishIcon className="w-4 h-4 stroke-[1.75]" />} label="Servicios" active={pathname.startsWith("/services")} />
            <DesktopNavItem href="/book" icon={<BookOpen className="w-4 h-4 stroke-[1.75]" />} label="Lookbook" active={pathname === "/book"} />
            {isAdmin && (
              <DesktopNavItem href="/admin" icon={<UserCircle className="w-4 h-4 stroke-[1.75]" />} label="Admin" active={pathname.startsWith("/admin")} />
            )}
          </nav>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            onClick={() => setIsLocationOpen(true)}
            className="w-10 h-10 bg-brand-primary text-white rounded-2xl flex items-center justify-center transition-all shadow-[0_4px_14px_rgba(197,160,101,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] hover:bg-brand-primary-light -mr-1"
            aria-label="Ubicación"
            title="Ubicación del Studio"
          >
            <MapPin className="w-5 h-5 stroke-[1.75]" />
          </motion.button>
        </div>
      </header>

      <LocationModal
        isOpen={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
        studioName="Milibeauty"
        studioAddress="Av. Principal Las Mercedes, Edificio Centro Empresarial, Piso 3, Local 302"
        mapsUrl="https://www.google.com/maps/search/?api=1&query=Milibeauty+Studio"
      />

      {/* ── MOBILE FLOATING LUXURY CAPSULE ── */}
      <motion.nav
        style={{ scale }}
        className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-[375px] gpu-layer"
      >
        <div className="glass-capsule rounded-3xl p-1.5 flex items-center justify-around relative touch-none select-none">
          <NavItem href="/" icon={<HomeIcon className="w-5 h-5 stroke-[1.6]" />} label="Inicio" active={pathname === "/"} />
          <NavItem href="/services" icon={<NailPolishIcon className="w-5 h-5 stroke-[1.6]" />} label="Servicios" active={pathname.startsWith("/services")} />
          <NavItem href="/book" icon={<BookOpen className="w-5 h-5 stroke-[1.6]" />} label="Lookbook" active={pathname === "/book"} />
          {isAdmin && (
            <NavItem href="/admin" icon={<UserCircle className="w-5 h-5 stroke-[1.6]" />} label="Admin" active={pathname.startsWith("/admin")} />
          )}
        </div>
      </motion.nav>
    </>
  );
}

function DesktopNavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      prefetch={true}
      className={`relative px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors duration-200 z-10 select-none ${
        active ? "text-white font-bold" : "text-stone-600 hover:text-stone-900"
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeDesktopNavIndicator"
          className="absolute inset-0 gold-gradient-pill rounded-xl"
          transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
          style={{ zIndex: -1 }}
        />
      )}
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.90 }}
      transition={{ type: "spring", stiffness: 500, damping: 25, mass: 0.5 }}
      className="flex-1 flex justify-center"
    >
      <Link
        href={href}
        prefetch={true}
        aria-label={label}
        title={label}
        className={`relative flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl transition-colors duration-200 z-10 w-full select-none ${
          active ? "text-white font-semibold" : "text-stone-500 hover:text-stone-800"
        }`}
      >
        {active && (
          <motion.div
            layoutId="activeNavIndicator"
            className="absolute inset-0 gold-gradient-pill rounded-2xl"
            initial={false}
            transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
            style={{ zIndex: -1 }}
          />
        )}
        <div className="relative z-10 flex items-center justify-center gap-1.5">
          {icon}
          <AnimatePresence mode="wait">
            {active && (
              <motion.span
                initial={{ opacity: 0, scaleX: 0, scale: 0.9 }}
                animate={{ opacity: 1, scaleX: 1, scale: 1 }}
                exit={{ opacity: 0, scaleX: 0, scale: 0.9 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: "left" }}
                className="text-[11.5px] font-bold tracking-tight whitespace-nowrap overflow-hidden origin-left"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </Link>
    </motion.div>
  );
}
