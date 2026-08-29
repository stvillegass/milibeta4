/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import Home from './components/Home';
import Services from './components/Services';
import Booking from './components/Booking';
import Admin from './components/Admin';
import ReservationModal from './components/ReservationModal';
import LocationModal from './components/LocationModal';
import { HomeIcon, Sparkles, BookOpen, UserCircle, MapPin } from 'lucide-react';

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

function Navigation() {
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith('/admin');

  const { scrollY } = useScroll();
  const scale = useTransform(scrollY, [0, 150], [1, 0.85]);

  const isDragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const navItem = el?.closest('[data-nav-path]');
    
    if (navItem) {
      const path = navItem.getAttribute('data-nav-path');
      if (path) {
        const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
        if (!isActive) {
           navigate(path);
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (isAdmin) return null;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-400/40 backdrop-blur-xl border-b border-zinc-400/30 shadow-[0_4px_12px_rgba(0,0,0,0.05),_inset_0_1px_1px_rgba(255,255,255,0.25)] transition-all">
        <div className="max-w-6xl lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link to="/" className="font-serif italic text-2xl sm:text-3xl tracking-tight text-brand-tertiary hover:opacity-80 transition-opacity ml-1">
            Milibeauty
          </Link>

          {/* Desktop Navigation Menu (Visible on md:) */}
          <nav aria-label="Navegación de escritorio" className="hidden md:flex items-center gap-1 bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-brand-outline/20 shadow-2xs">
            <DesktopNavItem to="/" icon={<HomeIcon className="w-4 h-4 stroke-[1.75]" />} label="Inicio" active={location.pathname === '/'} />
            <DesktopNavItem to="/services" icon={<NailPolishIcon className="w-4 h-4 stroke-[1.75]" />} label="Servicios" active={location.pathname.startsWith('/services')} />
            <DesktopNavItem to="/book" icon={<BookOpen className="w-4 h-4 stroke-[1.75]" />} label="Lookbook" active={location.pathname === '/book'} />
            <DesktopNavItem to="/admin" icon={<UserCircle className="w-4 h-4 stroke-[1.75]" />} label="Perfil" active={location.pathname.startsWith('/admin')} />
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

      {/* Mobile Bottom Navigation Bar (Exclusive to mobile < md) */}
      <motion.nav 
        style={{ scale }} 
        className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-[360px]"
      >
        <div 
          className="bg-zinc-400/40 backdrop-blur-xl border border-zinc-400/30 rounded-2xl p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.08),_inset_0_1px_1px_rgba(255,255,255,0.25)] flex items-center justify-around relative touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <NavItem to="/" icon={<HomeIcon className="w-5 h-5 stroke-[1.5]" />} label="Inicio" active={location.pathname === '/'} />
          <NavItem to="/services" icon={<NailPolishIcon className="w-5 h-5 stroke-[1.5]" />} label="Servicios" active={location.pathname.startsWith('/services')} />
          <NavItem to="/book" icon={<BookOpen className="w-5 h-5 stroke-[1.5]" />} label="Lookbook" active={location.pathname === '/book'} />
          <NavItem to="/admin" icon={<UserCircle className="w-5 h-5 stroke-[1.5]" />} label="Perfil" active={location.pathname.startsWith('/admin')} />
        </div>
      </motion.nav>
    </>
  );
}

function DesktopNavItem({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`relative px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-200 z-10 ${
        active
          ? 'text-white font-bold'
          : 'text-stone-600 hover:text-[#C5A065] hover:bg-[#C5A065]/10'
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

function NavItem({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <Link 
      to={to} 
      data-nav-path={to}
      draggable={false}
      aria-label={label}
      title={label}
      className={`relative flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl transition-colors duration-300 z-10 ${
        active 
          ? 'text-white font-semibold' 
          : 'text-stone-500 hover:text-[#C5A065] hover:bg-[#C5A065]/10'
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
              animate={{ opacity: 1, width: 'auto' }}
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

const navOrder = ['/', '/services', '/book', '/admin'];

function AppContent() {
  const location = useLocation();

  // Track navigation direction
  const [prevPath, setPrevPath] = useState(location.pathname);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (location.pathname !== prevPath) {
      const getIndex = (path: string) => {
        if (path === '/') return 0;
        const idx = navOrder.findIndex(p => p !== '/' && path.startsWith(p));
        return idx !== -1 ? idx : navOrder.length;
      };
      
      const prevIndex = getIndex(prevPath);
      const currIndex = getIndex(location.pathname);
      
      setDirection(currIndex > prevIndex ? 1 : -1);
      setPrevPath(location.pathname);
    }
  }, [location.pathname, prevPath]);

  const pageVariants = {
    initial: (dir: number) => ({
      opacity: 0,
      y: 10,
      x: dir !== 0 ? (dir > 0 ? '10%' : '-10%') : 0,
      scale: 0.985
    }),
    animate: {
      opacity: 1,
      y: 0,
      x: '0%',
      scale: 1
    },
    exit: (dir: number) => ({
      opacity: 0,
      y: -8,
      x: dir !== 0 ? (dir > 0 ? '-10%' : '10%') : 0,
      scale: 0.985
    })
  };

  return (
    <div className="min-h-screen w-full bg-brand-secondary relative overflow-x-hidden">
      <Navigation />
      <main className="pb-24 md:pb-12 relative w-full h-full min-h-screen">
        <AnimatePresence custom={direction} mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname}
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="w-full min-h-screen"
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/book" element={<Booking />} />
              <Route path="/reserve" element={<ReservationModal isOpen={true} />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
