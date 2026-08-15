"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { HomeIcon, BookOpen, UserCircle, MapPin } from "lucide-react";
import LocationModal from "./LocationModal";

function NailPolishIcon({ className = "w-5 h-5 stroke-[1.25]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
  const isAdmin = pathname.startsWith("/admin");

  const { scrollY } = useScroll();
  const scale = useTransform(scrollY, [0, 150], [1, 0.85]);

  if (isAdmin) return null;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-400/40 backdrop-blur-xl border-b border-zinc-400/30 shadow-[0_4px_12px_rgba(0,0,0,0.05),_inset_0_1px_1px_rgba(255,255,255,0.25)] transition-all">
        <div className="max-w-6xl lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="font-serif italic text-2xl sm:text-3xl tracking-tight text-brand-tertiary hover:opacity-80 transition-opacity ml-1">
            Milibeauty
          </Link>

          <nav aria-label="Navegación de escritorio" className="hidden md:flex items-center gap-1 bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-brand-outline/20 shadow-2xs">
            <DesktopNavItem href="/" icon={<HomeIcon className="w-4 h-4 stroke-[1.75]" />} label="Inicio" active={pathname === "/"} />
            <DesktopNavItem href="/services" icon={<NailPolishIcon className="w-4 h-4 stroke-[1.75]" />} label="Servicios" active={pathname.startsWith("/services")} />
            <DesktopNavItem href="/book" icon={<BookOpen className="w-4 h-4 stroke-[1.75]" />} label="Lookbook" active={pathname === "/book"} />
            <DesktopNavItem href="/admin" icon={<UserCircle className="w-4 h-4 stroke-[1.75]" />} label="Perfil" active={pathname.startsWith("/admin")} />
          </nav>

          <button
            onClick={() => setIsLocationOpen(true)}
            className="w-10 h-10 bg-brand-primary text-white rounded-2xl flex items-center justify-center transition-all shadow-2xs hover:bg-brand-primary-light active:scale-[0.94] -mr-1"
            aria-label="Ubicación"
            title="Ubicación del Studio"
          >
            <MapPin className="w-5 h-5 stroke-[1.75]" />
          </button>
        </div>
      </header>

      <LocationModal
        isOpen={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
        studioName="Milibeauty"
        studioAddress="Av. Principal Las Mercedes, Edificio Centro Empresarial, Piso 3, Local 302"
        mapsUrl="https://www.google.com/maps/search/?api=1&query=Milibeauty+Studio"
      />

      <motion.nav
        style={{ scale }}
        className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-[360px]"
      >
        <div className="bg-zinc-400/40 backdrop-blur-xl border border-zinc-400/30 rounded-2xl p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.08),_inset_0_1px_1px_rgba(255,255,255,0.25)] flex items-center justify-around relative touch-none select-none">
          <NavItem href="/" icon={<HomeIcon className="w-5 h-5 stroke-[1.5]" />} label="Inicio" active={pathname === "/"} />
          <NavItem href="/services" icon={<NailPolishIcon className="w-5 h-5 stroke-[1.5]" />} label="Servicios" active={pathname.startsWith("/services")} />
          <NavItem href="/book" icon={<BookOpen className="w-5 h-5 stroke-[1.5]" />} label="Lookbook" active={pathname === "/book"} />
          <NavItem href="/admin" icon={<UserCircle className="w-5 h-5 stroke-[1.5]" />} label="Perfil" active={pathname.startsWith("/admin")} />
        </div>
      </motion.nav>
    </>
  );
}

function DesktopNavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-200 z-10 ${
        active ? "text-white font-bold" : "text-stone-600 hover:text-[#C5A065] hover:bg-[#C5A065]/10"
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeDesktopNavIndicator"
          className="absolute inset-0 bg-[#C5A065] rounded-xl shadow-xs"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
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
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`relative flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl transition-colors duration-300 z-10 ${
        active ? "text-white font-semibold" : "text-stone-500 hover:text-[#C5A065] hover:bg-[#C5A065]/10"
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeNavIndicator"
          className="absolute inset-0 bg-[#C5A065] rounded-xl shadow-md shadow-[#C5A065]/25"
          initial={false}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          style={{ zIndex: -1 }}
        />
      )}
      <div className="relative z-10 flex items-center gap-2">
        {icon}
        <AnimatePresence>
          {active && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[12px] tracking-tight whitespace-nowrap overflow-hidden"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Link>
  );
}