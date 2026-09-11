import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Calendar, Settings, Sparkles, Plus, Loader2, ArrowLeft, Lock, Clock, 
  CalendarX, Check, Trash2, Save, AlertCircle, X, ChevronDown, ChevronUp, 
  ChevronLeft, ChevronRight, ExternalLink, Pencil, Upload, Image as ImageIcon, Star, List,
  Bell, Volume2, VolumeX, Smartphone, Send, CheckCircle, RefreshCw, MapPin, Navigation
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatTime12h } from '../lib/timeFormat';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Service } from '../types';

// Audio chime synthesized via Web Audio API for zero-dependency sound alert
function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.3); // G5

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.6);
  } catch (e) {
    console.error("Audio chime error:", e);
  }
}

// Triggers native browser / OS system notification
function triggerSystemNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: '/favicon.ico',
            vibrate: [200, 100, 200, 100, 200],
            data: { url: '/admin' }
          } as any);
        }).catch(() => {
          new Notification(title, { body, icon: '/favicon.ico' });
        });
      } else {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    } catch (e) {
      console.error("System notification error:", e);
    }
  }
}

// Helper to convert base64 VAPID key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Registers Service Worker and Subscribes Admin device to Web Push notifications
async function registerAndSubscribeWebPush() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn("Web Push no es soportado en este navegador.");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Fetch VAPID Public Key from API
    const res = await fetch('/api/push/vapid-key');
    const { publicKey } = await res.json();

    if (!publicKey) return false;

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    // Save subscription in server DB
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    return true;
  } catch (error) {
    console.error("Error al suscribir Web Push:", error);
    return false;
  }
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'schedule' | 'calendar' | 'services' | 'interface' | 'notifications'>('schedule');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [webhookUrl, setWebhookUrl] = useState('');
  const [whatsappAlertPhone, setWhatsappAlertPhone] = useState('+584120574955');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const navigate = useNavigate();

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
      const tab = navItem.getAttribute('data-nav-path') as 'schedule' | 'calendar' | 'services' | 'interface' | 'notifications';
      if (tab && activeTab !== tab) {
        setActiveTab(tab);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Notification Polling & Background Detection
  useEffect(() => {
    // Check initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setIsAuthLoading(false);
    });

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsAuthenticated(!!session);
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Auto-subscribe to Web Push if permission already granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      registerAndSubscribeWebPush().then(success => setIsPushSubscribed(!!success));
    }

    fetch('/api/notification-settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
          if (data.whatsappNumber) setWhatsappAlertPhone(data.whatsappNumber);
        }
      })
      .catch(() => {});

    let knownIds = new Set<string>();

    const fetchNotifs = () => {
      fetch('/api/notifications')
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount || 0);

            // Detect new booking notifications
            const newItems = data.notifications.filter((n: any) => !knownIds.has(n.id));
            if (knownIds.size > 0 && newItems.length > 0) {
              const latest = newItems[0];
              playNotificationChime();
              triggerSystemNotification(latest.title, latest.message);
            }

            data.notifications.forEach((n: any) => knownIds.add(n.id));
          }
        })
        .catch(() => {});
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 4000); // Check every 4s

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleMarkAllRead = () => {
    fetch('/api/notifications/mark-read', { method: 'POST' })
      .then(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      });
  };

  const handleMarkOneRead = (id: string) => {
    fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    }).then(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    });
  };

  const handleDeleteNotif = (id: string) => {
    fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      .then(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      });
  };

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) {
      alert("Tu navegador no soporta notificaciones del sistema.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermissionState(result);
    if (result === 'granted') {
      playNotificationChime();
      const subscribed = await registerAndSubscribeWebPush();
      setIsPushSubscribed(subscribed);
      triggerSystemNotification("¡Notificaciones Push Activadas! 💅", "Tu dispositivo ahora recibirá alertas flotantes cuando se agende una cita, incluso en segundo plano.");
    }
  };

  const handleTestNotif = () => {
    playNotificationChime();
    if (Notification.permission === 'granted') {
      triggerSystemNotification("¡Notificación de Prueba MiliBeauty! 💅", "Esta es una alerta local para el administrador.");
      fetch('/api/push/test', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          console.log("Servidor envió Push de prueba:", data);
        });
    } else {
      alert("Debes activar las notificaciones haciendo clic en 'Activar Notificaciones Web Push'.");
    }
  };

  const handleSaveNotifSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    fetch('/api/notification-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl,
        whatsappNumber: whatsappAlertPhone
      })
    })
      .then(() => {
        setIsSavingSettings(false);
        alert("Configuración de notificaciones guardada exitosamente.");
      })
      .catch(() => setIsSavingSettings(false));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      alert("Error al iniciar sesión: " + error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-5 bg-brand-secondary relative">
        <button onClick={() => navigate(-1)} className="absolute top-5 left-5 p-2 text-brand-tertiary">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-brand-outline/10 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-primary">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif mb-2 text-brand-tertiary">Panel de Administración</h1>
          <p className="text-xs text-brand-tertiary/60 mb-6">Milibeauty Beauty Salon</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-brand-secondary rounded-xl border border-brand-outline/10 outline-none text-sm focus:border-brand-primary"
              required
            />
            <input
              type="password"
              placeholder="Contraseña de administrador"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-brand-secondary rounded-xl border border-brand-outline/10 outline-none text-sm focus:border-brand-primary"
              required
            />
            <button
              type="submit"
              className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:opacity-90 transition-opacity"
            >
              Ingresar al Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-brand-secondary text-brand-tertiary w-full">
      {/* Sidebar for desktop */}
      <aside className="w-64 bg-white border-r border-brand-outline/10 hidden md:flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-6 border-b border-brand-outline/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1 -ml-2 text-brand-tertiary hover:bg-brand-secondary-dark rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="font-serif italic text-2xl font-light tracking-tight">Milibeauty</h2>
          </div>

          <button
            onClick={() => setActiveTab('notifications')}
            title="Notificaciones de Citas"
            className="relative p-2 text-brand-tertiary hover:bg-brand-secondary rounded-xl transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {/* Schedule */}
          <button 
            onClick={() => setActiveTab('schedule')} 
            className={`w-full relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors z-10 text-left ${
              activeTab === 'schedule' ? 'text-white font-bold' : 'text-brand-tertiary hover:bg-brand-secondary-dark'
            }`}
          >
            {activeTab === 'schedule' && (
              <motion.div
                layoutId="activeDesktopAdminNavIndicator"
                className="absolute inset-0 bg-[#C5A065] rounded-xl shadow-sm"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                style={{ zIndex: -1 }}
              />
            )}
            <Clock className="w-5 h-5 relative z-10" /> <span className="relative z-10">Horarios y Días</span>
          </button>

          {/* Calendar */}
          <button 
            onClick={() => setActiveTab('calendar')} 
            className={`w-full relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors z-10 text-left ${
              activeTab === 'calendar' ? 'text-white font-bold' : 'text-brand-tertiary hover:bg-brand-secondary-dark'
            }`}
          >
            {activeTab === 'calendar' && (
              <motion.div
                layoutId="activeDesktopAdminNavIndicator"
                className="absolute inset-0 bg-[#C5A065] rounded-xl shadow-sm"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                style={{ zIndex: -1 }}
              />
            )}
            <Calendar className="w-5 h-5 relative z-10" /> <span className="relative z-10">Citas y Calendario</span>
          </button>

          {/* Notifications */}
          <button 
            onClick={() => setActiveTab('notifications')} 
            className={`w-full relative flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-colors z-10 text-left ${
              activeTab === 'notifications' ? 'text-white font-bold' : 'text-brand-tertiary hover:bg-brand-secondary-dark'
            }`}
          >
            {activeTab === 'notifications' && (
              <motion.div
                layoutId="activeDesktopAdminNavIndicator"
                className="absolute inset-0 bg-[#C5A065] rounded-xl shadow-sm"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                style={{ zIndex: -1 }}
              />
            )}
            <div className="flex items-center gap-3 relative z-10">
              <Bell className={`w-5 h-5 ${activeTab === 'notifications' ? 'text-white' : 'text-amber-500'}`} />
              <span>Notificaciones</span>
            </div>
            {unreadCount > 0 && (
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full relative z-10 ${activeTab === 'notifications' ? 'bg-white/30 text-white' : 'bg-red-500 text-white'}`}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Services */}
          <button 
            onClick={() => setActiveTab('services')} 
            className={`w-full relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors z-10 text-left ${
              activeTab === 'services' ? 'text-white font-bold' : 'text-brand-tertiary hover:bg-brand-secondary-dark'
            }`}
          >
            {activeTab === 'services' && (
              <motion.div
                layoutId="activeDesktopAdminNavIndicator"
                className="absolute inset-0 bg-[#C5A065] rounded-xl shadow-sm"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                style={{ zIndex: -1 }}
              />
            )}
            <Settings className="w-5 h-5 relative z-10" /> <span className="relative z-10">Servicios</span>
          </button>

          {/* Interface */}
          <button 
            onClick={() => setActiveTab('interface')} 
            className={`w-full relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors z-10 text-left ${
              activeTab === 'interface' ? 'text-white font-bold' : 'text-brand-tertiary hover:bg-brand-secondary-dark'
            }`}
          >
            {activeTab === 'interface' && (
              <motion.div
                layoutId="activeDesktopAdminNavIndicator"
                className="absolute inset-0 bg-[#C5A065] rounded-xl shadow-sm"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                style={{ zIndex: -1 }}
              />
            )}
            <ImageIcon className="w-5 h-5 relative z-10" /> <span className="relative z-10">Interfaz Cliente</span>
          </button>
        </nav>
        <div className="p-4 border-t border-brand-outline/10">
          <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-brand-tertiary/60 hover:text-brand-tertiary">Cerrar sesión</button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 pb-32 md:pb-10">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-brand-outline/10 p-4 flex justify-between items-center shadow-xs">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-brand-tertiary">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="font-serif italic text-xl tracking-tight">Admin</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('notifications')}
              className="relative p-2 text-brand-tertiary hover:bg-brand-secondary rounded-xl transition-colors"
            >
              <Bell className="w-5 h-5 text-amber-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            <button onClick={handleLogout} className="text-sm font-semibold text-brand-tertiary/80 hover:text-brand-tertiary">Salir</button>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 14, scale: 0.99 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -14, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="w-full"
            >
              {activeTab === 'schedule' && <ScheduleTab />}
              {activeTab === 'calendar' && <CalendarTab />}
              {activeTab === 'notifications' && (
                <NotificationsTab
                  notifications={notifications}
                  unreadCount={unreadCount}
                  permissionState={permissionState}
                  isPushSubscribed={isPushSubscribed}
                  onRequestPermission={handleRequestPermission}
                  onTestNotif={handleTestNotif}
                  onMarkAllRead={handleMarkAllRead}
                  onMarkOneRead={handleMarkOneRead}
                  onDeleteNotif={handleDeleteNotif}
                  webhookUrl={webhookUrl}
                  setWebhookUrl={setWebhookUrl}
                  whatsappAlertPhone={whatsappAlertPhone}
                  setWhatsappAlertPhone={setWhatsappAlertPhone}
                  onSaveSettings={handleSaveNotifSettings}
                  isSavingSettings={isSavingSettings}
                />
              )}
              {activeTab === 'services' && <ServicesTab />}
              {activeTab === 'interface' && <ClientInterfaceTab />}
            </motion.div>
          </AnimatePresence>
        </div>
        {/* Mobile Bottom Navigation Bar (Floating capsule matching client style) */}
        <nav aria-label="Navegación Móvil Admin" className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px]">
          <div className="bg-zinc-400/40 backdrop-blur-xl border border-zinc-400/30 rounded-full p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.08),_inset_0_1px_1px_rgba(255,255,255,0.25)] flex items-center justify-around relative select-none">
            <AdminMobileNavItem 
              active={activeTab === 'schedule'} 
              onClick={() => setActiveTab('schedule')} 
              icon={<Clock className="w-4.5 h-4.5 stroke-[1.5]" />} 
              label="Horarios" 
            />
            <AdminMobileNavItem 
              active={activeTab === 'calendar'} 
              onClick={() => setActiveTab('calendar')} 
              icon={<Calendar className="w-4.5 h-4.5 stroke-[1.5]" />} 
              label="Citas" 
            />
            <AdminMobileNavItem 
              active={activeTab === 'notifications'} 
              onClick={() => setActiveTab('notifications')} 
              icon={<Bell className="w-4.5 h-4.5 stroke-[1.5]" />} 
              label="Notif." 
              badgeCount={unreadCount}
            />
            <AdminMobileNavItem 
              active={activeTab === 'services'} 
              onClick={() => setActiveTab('services')} 
              icon={<Sparkles className="w-4.5 h-4.5 stroke-[1.5]" />} 
              label="Servicios" 
            />
            <AdminMobileNavItem 
              active={activeTab === 'interface'} 
              onClick={() => setActiveTab('interface')} 
              icon={<Settings className="w-4.5 h-4.5 stroke-[1.5]" />} 
              label="Ajustes" 
            />
          </div>
        </nav>
      </main>
    </div>
  );
}

function AdminMobileNavItem({ 
  active, 
  onClick, 
  icon, 
  label, 
  badgeCount 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
  badgeCount?: number; 
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`relative flex items-center justify-center gap-1.5 py-2 px-3 rounded-full transition-colors duration-300 z-10 ${
        active 
          ? 'text-white font-semibold' 
          : 'text-stone-600 hover:text-[#C5A065] hover:bg-[#C5A065]/10'
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeAdminMobileNavIndicator"
          className="absolute inset-0 bg-[#C5A065] rounded-full shadow-md shadow-[#C5A065]/25"
          initial={false}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          style={{ zIndex: -1 }}
        />
      )}
      <div className="relative z-10 flex items-center gap-1.5">
        <div className="relative flex items-center">
          {icon}
          {badgeCount && badgeCount > 0 ? (
            <span className={`absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] ${active ? 'bg-white text-[#C5A065]' : 'bg-rose-500 text-white'} font-bold text-[9px] rounded-full flex items-center justify-center shadow-2xs`}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          ) : null}
        </div>
        <AnimatePresence>
          {active && (
            <motion.span 
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[11px] tracking-tight whitespace-nowrap overflow-hidden"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
}

// -----------------------------------------
// Notifications Tab Component
// -----------------------------------------
function NotificationsTab({
  notifications,
  unreadCount,
  permissionState,
  isPushSubscribed,
  onRequestPermission,
  onTestNotif,
  onMarkAllRead,
  onMarkOneRead,
  onDeleteNotif,
  webhookUrl,
  setWebhookUrl,
  whatsappAlertPhone,
  setWhatsappAlertPhone,
  onSaveSettings,
  isSavingSettings
}: {
  notifications: any[];
  unreadCount: number;
  permissionState: string;
  isPushSubscribed: boolean;
  onRequestPermission: () => void;
  onTestNotif: () => void;
  onMarkAllRead: () => void;
  onMarkOneRead: (id: string) => void;
  onDeleteNotif: (id: string) => void;
  webhookUrl: string;
  setWebhookUrl: (val: string) => void;
  whatsappAlertPhone: string;
  setWhatsappAlertPhone: (val: string) => void;
  onSaveSettings: (e: React.FormEvent) => void;
  isSavingSettings: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-brand-outline/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-6 h-6 text-amber-500 animate-bounce" />
            <h2 className="text-2xl font-serif italic text-brand-tertiary">Notificaciones de Citas (Solo Admin)</h2>
          </div>
          <p className="text-xs text-brand-tertiary/70">
            Recibe avisos flotantes e inmediatos en tu dispositivo al instante en que una cliente agende una cita, incluso en segundo plano.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="px-4 py-2.5 bg-brand-secondary hover:bg-brand-primary/10 text-brand-primary font-bold text-xs rounded-2xl border border-brand-outline/10 transition-colors flex items-center gap-2 self-start md:self-auto"
          >
            <CheckCircle className="w-4 h-4" /> Marcar todas como leídas ({unreadCount})
          </button>
        )}
      </div>

      {/* System & Push Notification Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-brand-outline/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-brand-outline/10">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-brand-primary" />
              <h3 className="font-bold text-sm text-brand-tertiary">Web Push & Alertas en Pantalla</h3>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase ${
                isPushSubscribed || permissionState === 'granted'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : permissionState === 'denied'
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-amber-100 text-amber-700 border border-amber-300'
              }`}
            >
              {isPushSubscribed ? 'Web Push Activo 📲' : permissionState === 'granted' ? 'Permiso Concedido ✅' : permissionState === 'denied' ? 'Bloqueadas ❌' : 'Pendiente ⚠️'}
            </span>
          </div>

          <p className="text-xs text-brand-tertiary/80 leading-relaxed">
            Al activar este permiso, tu navegador registrará la suscripción Web Push con llaves VAPID. Recibirás un aviso emergente flotante en tu dispositivo cuando una cliente reserve desde la web pública.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {!isPushSubscribed && permissionState !== 'granted' ? (
              <button
                onClick={onRequestPermission}
                className="flex-1 px-4 py-3 bg-brand-primary text-white font-bold text-xs rounded-2xl shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" /> Activar Notificaciones Web Push
              </button>
            ) : (
              <button
                onClick={onTestNotif}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                <Volume2 className="w-4 h-4" /> Probar Alerta Web Push y Sonido
              </button>
            )}
          </div>
        </div>

        {/* External Webhook & WhatsApp Alerts */}
        <form onSubmit={onSaveSettings} className="bg-white p-6 rounded-3xl border border-brand-outline/10 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-brand-outline/10">
            <Send className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-sm text-brand-tertiary">Notificaciones 24/7 (Webhook / WhatsApp)</h3>
          </div>

          <div>
            <label className="text-[11px] font-bold text-brand-tertiary/60 uppercase block mb-1">
              Teléfono Admin para WhatsApp Directo
            </label>
            <input
              type="text"
              placeholder="+584120574955"
              value={whatsappAlertPhone}
              onChange={e => setWhatsappAlertPhone(e.target.value)}
              className="w-full bg-brand-secondary/40 p-2.5 rounded-xl border border-brand-outline/20 text-xs font-semibold outline-none focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-brand-tertiary/60 uppercase block mb-1">
              Webhook URL (Opcional - Zapier, Telegram Bot, Make)
            </label>
            <input
              type="url"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              className="w-full bg-brand-secondary/40 p-2.5 rounded-xl border border-brand-outline/20 text-xs outline-none focus:border-brand-primary"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingSettings}
            className="w-full py-2.5 bg-brand-tertiary text-white font-bold text-xs rounded-2xl hover:bg-brand-tertiary/90 transition-colors flex items-center justify-center gap-2"
          >
            {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Guardar Configuración</span>
          </button>
        </form>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-3xl border border-brand-outline/10 overflow-hidden shadow-sm">
        <div className="p-5 bg-brand-secondary/40 border-b border-brand-outline/10 flex items-center justify-between">
          <h3 className="font-serif italic text-lg text-brand-tertiary">
            Historial de Notificaciones Recibidas ({notifications.length})
          </h3>
          <span className="text-xs font-bold px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-xl">
            {unreadCount} sin leer
          </span>
        </div>

        {notifications.length === 0 ? (
          <div className="p-12 text-center text-brand-tertiary/50 space-y-2">
            <Bell className="w-10 h-10 mx-auto text-brand-tertiary/30" />
            <p className="text-xs font-medium">No hay notificaciones recibidas aún.</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-outline/10">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  !n.read ? 'bg-amber-50/60 font-medium' : 'hover:bg-brand-secondary/30'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.read && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    )}
                    <h4 className="text-xs font-bold text-brand-tertiary">{n.title}</h4>
                    <span className="text-[10px] text-brand-tertiary/50">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-brand-tertiary/80">{n.message}</p>

                  {n.clientPhone && (
                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={`https://wa.me/${n.clientPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${n.clientName}, recibimos tu cita para el ${n.date} a las ${formatTime12h(n.time)} en MiliBeauty.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-200 transition-colors flex items-center gap-1"
                      >
                        💬 Confirmar por WhatsApp a {n.clientName} ({n.clientPhone})
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {!n.read && (
                    <button
                      onClick={() => onMarkOneRead(n.id)}
                      className="px-2.5 py-1 bg-white text-brand-primary border border-brand-outline/20 hover:bg-brand-primary/10 rounded-xl text-xs font-bold transition-colors"
                    >
                      Leída
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteNotif(n.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Eliminar notificación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------
// Calendar Tab
// -----------------------------------------
function CalendarTab() {
  const [events, setEvents] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const loadData = async () => {
    setLoading(true);
    let calendarData: any[] = [];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/calendar/events', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      calendarData = await res.json();
    } catch (e) {}

    let bookingsData: any[] = [];
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services ( name ),
          service_options ( name, price, duration_minutes )
        `);
        
      if (!error && data) {
        bookingsData = data.map((b: any) => {
          const startDate = new Date(b.start_time);
          const dateStr = format(startDate, 'yyyy-MM-dd');
          const timeStr = format(startDate, 'HH:mm');
          
          return {
            id: b.id,
            date: dateStr,
            time: timeStr,
            clientName: b.client_name,
            clientPhone: b.client_phone,
            serviceName: b.services?.name || 'Servicio Eliminado',
            optionName: b.service_options?.name || '',
            price: b.service_options?.price || 0,
            status: b.status,
            paymentMethod: 'N/A', // No persistido en el esquema actual
            googleEventId: b.google_event_id
          };
        });
      }
    } catch (e) {
      console.error("Error fetching bookings:", e);
    }

    if (Array.isArray(calendarData)) setEvents(calendarData);
    setBookings(bookingsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteBooking = async (id: string) => {
    if (!confirm("¿Estás segura de que deseas cancelar/eliminar esta reserva?")) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (!error) {
        setBookings(prev => prev.filter(b => b.id !== id));
      } else {
        alert("Error al eliminar la reserva");
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  // Calendar dates calculation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayBookings = bookings.filter(b => b.date === selectedDateStr);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-brand-outline/10 shadow-sm">
        <div>
          <h2 className="text-2xl font-serif italic text-brand-tertiary">Calendario de la Plataforma</h2>
          <p className="text-xs text-brand-tertiary/60">Gestiona las citas agendadas y consulta la sincronización con Google Calendar.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-brand-secondary p-1 rounded-xl border border-brand-outline/10">
            <button
              onClick={() => setViewMode('calendar')}
              title="Vista Calendario"
              className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'calendar' 
                  ? 'bg-brand-primary text-white shadow-xs' 
                  : 'text-brand-tertiary hover:text-brand-primary hover:bg-white/50'
              }`}
            >
              <Calendar className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title={`Vista Lista (${bookings.length} citas)`}
              className={`p-2.5 rounded-lg transition-all flex items-center justify-center relative ${
                viewMode === 'list' 
                  ? 'bg-brand-primary text-white shadow-xs' 
                  : 'text-brand-tertiary hover:text-brand-primary hover:bg-white/50'
              }`}
            >
              <List className="w-5 h-5" />
              {bookings.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-brand-tertiary font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-white">
                  {bookings.length}
                </span>
              )}
            </button>
          </div>

          {/* Button to view Google Calendar Events Modal */}
          <button
            onClick={() => setShowGoogleModal(true)}
            title={`Eventos sincronizados de Google Calendar (${events.length})`}
            className="p-2.5 bg-brand-tertiary text-white rounded-xl hover:bg-brand-tertiary/90 transition-all shadow-xs relative flex items-center justify-center"
          >
            <Calendar className="w-5 h-5 text-amber-300" />
            {events.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 text-brand-tertiary font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-white">
                {events.length}
              </span>
            )}
          </button>

          {/* External Google Calendar Link */}
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir Google Calendar en navegador"
            className="p-2.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Interactive Monthly Platform Calendar */}
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-brand-outline/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-brand-outline/10">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-brand-secondary rounded-xl text-brand-tertiary transition-colors"
                  title="Mes anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-serif italic capitalize text-brand-tertiary">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </h3>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-brand-secondary rounded-xl text-brand-tertiary transition-colors"
                  title="Mes siguiente"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={() => {
                  setCurrentMonth(new Date());
                  setSelectedDate(new Date());
                }}
                className="px-3 py-1.5 bg-brand-secondary hover:bg-brand-primary/10 text-brand-tertiary text-xs font-bold rounded-xl transition-colors border border-brand-outline/10"
              >
                Hoy
              </button>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 text-center gap-1">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                <div key={d} className="text-[11px] font-bold text-brand-tertiary/50 uppercase py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Monthly Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isCurrent = isSameMonth(day, currentMonth);
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                
                const dayBookings = bookings.filter(b => b.date === dateStr);
                const count = dayBookings.length;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[72px] p-1.5 rounded-xl border flex flex-col justify-between text-left transition-all relative ${
                      isSelected
                        ? 'bg-brand-tertiary text-white border-brand-tertiary shadow-md ring-2 ring-brand-primary'
                        : isTodayDate
                        ? 'bg-brand-primary/10 text-brand-tertiary border-brand-primary font-bold'
                        : !isCurrent
                        ? 'bg-gray-50/50 text-gray-300 border-gray-100 opacity-60'
                        : 'bg-white text-brand-tertiary border-brand-outline/10 hover:border-brand-primary/40 hover:bg-brand-secondary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-white' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {isTodayDate && !isSelected && (
                        <span className="text-[8px] font-bold text-brand-primary uppercase">Hoy</span>
                      )}
                    </div>

                    {count > 0 && (
                      <div className="mt-1">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md block text-center truncate ${
                            isSelected
                              ? 'bg-amber-300 text-brand-tertiary font-extrabold'
                              : 'bg-brand-primary text-white shadow-2xs'
                          }`}
                        >
                          {count} {count === 1 ? 'Cita' : 'Citas'}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bookings for Selected Date */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-brand-outline/10 shadow-sm flex flex-col">
            <div className="pb-3 border-b border-brand-outline/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-brand-tertiary/50 uppercase block">Citas Agendadas</span>
                <h3 className="text-lg font-serif italic text-brand-tertiary capitalize">
                  {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-brand-primary/10 text-brand-primary rounded-xl">
                {selectedDayBookings.length} {selectedDayBookings.length === 1 ? 'Cita' : 'Citas'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-3 max-h-[420px] pr-1">
              {selectedDayBookings.length === 0 ? (
                <div className="text-center py-12 px-4 text-brand-tertiary/50 bg-brand-secondary/30 rounded-2xl border border-dashed border-brand-outline/20">
                  <CalendarX className="w-8 h-8 mx-auto mb-2 text-brand-tertiary/30" />
                  <p className="text-xs font-medium">No hay citas agendadas en la plataforma para este día.</p>
                </div>
              ) : (
                selectedDayBookings.map(b => (
                  <div key={b.id} className="p-3.5 bg-brand-secondary/40 rounded-2xl border border-brand-outline/15 space-y-2 hover:bg-brand-secondary/70 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-brand-tertiary">{b.clientName}</span>
                        <a
                          href={`https://wa.me/${b.clientPhone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 hover:bg-emerald-100 transition-colors"
                        >
                          💬 {b.clientPhone}
                        </a>
                      </div>
                      <span className="text-xs font-bold text-brand-primary bg-white px-2 py-1 rounded-lg border border-brand-outline/10">
                        ⏰ {formatTime12h(b.time)}
                      </span>
                    </div>

                    <div className="text-xs text-brand-tertiary/80 space-y-0.5">
                      <p><strong>Servicio:</strong> {b.serviceName || 'Servicio'} ({b.optionName || 'Opción'})</p>
                      <p className="flex items-center justify-between text-[11px] text-brand-tertiary/60 pt-1">
                        <span>Pago: {b.paymentMethod === 'pagomovil' ? 'Pago Móvil' : b.paymentMethod === 'transferencia' ? 'Transferencia' : 'En Tienda'} {b.referenceNumber && `(Ref: ${b.referenceNumber})`}</span>
                        <span className="font-bold text-brand-tertiary">${b.price}</span>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-brand-outline/10 flex justify-end">
                      <button
                        onClick={() => handleDeleteBooking(b.id)}
                        className="text-[11px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Cancelar Cita
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List View of All Bookings */
        <div className="bg-white rounded-2xl border border-brand-outline/10 overflow-hidden shadow-sm">
          <div className="p-4 bg-brand-secondary/40 border-b border-brand-outline/10 flex items-center justify-between">
            <h3 className="font-serif italic text-lg text-brand-tertiary">Todas las Citas Agendadas ({bookings.length})</h3>
          </div>

          {bookings.length === 0 ? (
            <div className="p-10 text-center text-brand-tertiary/50">No hay reservas en la plataforma.</div>
          ) : (
            <div className="divide-y divide-brand-outline/10">
              {bookings.map(b => (
                <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-brand-secondary/40 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-tertiary">{b.clientName}</span>
                      <a
                        href={`https://wa.me/${b.clientPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        💬 {b.clientPhone}
                      </a>
                    </div>
                    <p className="text-xs text-brand-tertiary/80">
                      <strong>Servicio:</strong> {b.serviceName || 'Servicio'} - {b.optionName || 'Opción'} (${b.price})
                    </p>
                    <p className="text-[11px] text-brand-tertiary/60">
                      <strong>Método de Pago:</strong> {b.paymentMethod === 'pagomovil' ? 'Pago Móvil' : b.paymentMethod === 'transferencia' ? 'Transferencia' : 'En Tienda'} 
                      {b.referenceNumber && ` (Ref: ${b.referenceNumber})`}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <p className="text-sm font-bold text-brand-tertiary">📅 {b.date}</p>
                      <p className="text-xs font-semibold text-brand-primary">⏰ {formatTime12h(b.time)}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteBooking(b.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-xs font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" /> Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal for Google Calendar Synced Events */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-brand-outline/20 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-brand-outline/10">
              <div className="flex items-center gap-2 text-brand-tertiary">
                <Calendar className="w-5 h-5 text-brand-primary" />
                <h3 className="text-xl font-serif italic">Eventos Sincronizados de Google Calendar</h3>
              </div>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="p-1.5 text-brand-tertiary/50 hover:text-brand-tertiary hover:bg-brand-secondary rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-brand-tertiary/70">
              Mostrando los eventos traídos directamente desde tu cuenta de Google Calendar vinculada.
            </p>

            <div className="max-h-80 overflow-y-auto divide-y divide-brand-outline/10 pr-1">
              {events.length === 0 ? (
                <div className="p-8 text-center text-brand-tertiary/50">No hay eventos próximos sincronizados en Google Calendar.</div>
              ) : (
                events.map((e: any) => (
                  <div key={e.id} className="py-3 flex items-start justify-between gap-3 hover:bg-brand-secondary/30 px-2 rounded-xl">
                    <div>
                      <h4 className="font-bold text-xs text-brand-tertiary">{e.summary || 'Cita / Evento sin título'}</h4>
                      {e.description && <p className="text-[11px] text-brand-tertiary/60 mt-0.5">{e.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-brand-primary">
                        {new Date(e.start.dateTime || e.start.date).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-brand-tertiary/60">
                        {new Date(e.start.dateTime || e.start.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-brand-outline/10 flex items-center justify-between">
              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir Google Calendar Web
              </a>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="px-4 py-2 bg-brand-tertiary text-white font-bold rounded-xl text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------
// Services Tab (dnd-kit)
// -----------------------------------------
function ServicesTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'nails' | 'lashes' | null>(null);
  
  // New/Edit service form state
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServiceImageUrl, setNewServiceImageUrl] = useState('');
  const [newServiceOptions, setNewServiceOptions] = useState<Array<{
    id: string;
    name: string;
    price: string | number;
    description?: string;
    duration?: string;
    includes?: string;
  }>>([
    {
      id: 'o1',
      name: 'Clásico',
      price: '25',
      description: 'Limpieza esencial de cutículas y esmaltado semipermanente de alta resistencia.',
      duration: '45 min',
      includes: 'Limpieza básica, Limado y forma, Esmaltado monocolor, Aceite de cutículas'
    },
    {
      id: 'o2',
      name: 'Premium',
      price: '35',
      description: 'Tratamiento Spa completo con nivelación de Rubber Base y exfoliación nutritiva.',
      duration: '70 min',
      includes: 'Manicura combinada, Nivelación Rubber Base, Esmaltado + Nail Art, Exfoliación suave'
    }
  ]);
  const [isSavingService, setIsSavingService] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadServices = async () => {
    const { data: sData, error: sErr } = await supabase
      .from('services')
      .select('*, service_options(*)')
      .order('order_index', { ascending: true });
      
    if (sErr || !sData) {
      console.error('Error fetching services:', sErr);
      return;
    }
    
    const mapped = sData.map((s: any) => ({
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
        duration: o.duration_minutes ? `${o.duration_minutes} min` : '60 min',
      }))
    }));
    setServices(mapped);
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setServices((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex).map((s, idx) => ({...s, order: idx}));
        
        // Background update in Supabase
        Promise.all(newArray.map(s => 
          supabase.from('services').update({ order_index: s.order }).eq('id', s.id)
        )).catch(err => console.error("Error updating order", err));
        
        return newArray;
      });
    }
  };

  const openAddModal = () => {
    setEditingServiceId(null);
    setSelectedCategory(null);
    setNewServiceName('');
    setNewServiceDesc('');
    setNewServiceImageUrl('');
    setNewServiceOptions([
      {
        id: 'o1',
        name: 'Clásico',
        price: '25',
        description: 'Servicio clásico de acabado impecable y profesional.',
        duration: '45 min',
        includes: 'Limpieza esencial, Limado, Esmaltado monocolor, Aceite nutritivo'
      },
      {
        id: 'o2',
        name: 'Premium',
        price: '35',
        description: 'Tratamiento completo con nivelación, diseño personalizado e hidratación profunda.',
        duration: '70 min',
        includes: 'Manicura combinada, Nivelación Rubber Base, Nail Art libre, Exfoliación'
      }
    ]);
    setIsAddModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingServiceId(service.id);
    setSelectedCategory(service.category);
    setNewServiceName(service.name);
    setNewServiceDesc(service.description);
    setNewServiceImageUrl(service.imageUrl);
    setNewServiceOptions(
      service.options && service.options.length > 0
        ? service.options.map(opt => ({
            ...opt,
            price: opt.price.toString(),
            description: opt.description || '',
            duration: opt.duration || '60 min',
            includes: Array.isArray(opt.includes) ? opt.includes.join(', ') : (opt.includes || '')
          }))
        : [{ id: 'o1', name: 'General', price: '25', description: '', duration: '60 min', includes: '' }]
    );
    setIsAddModalOpen(true);
  };

  const handleAddOption = () => {
    setNewServiceOptions(prev => [
      ...prev,
      { id: `o_${Date.now()}`, name: 'Nueva Modalidad', price: '25', description: '', duration: '60 min', includes: '' }
    ]);
  };

  const handleUpdateOption = (index: number, field: string, value: any) => {
    setNewServiceOptions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveOption = (index: number) => {
    if (newServiceOptions.length <= 1) return;
    setNewServiceOptions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !newServiceName.trim()) return;

    setIsSavingService(true);
    try {
      const defaultImg = selectedCategory === 'nails'
        ? 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop'
        : 'https://images.unsplash.com/photo-1588661609100-3490b6cba2d3?q=80&w=1000&auto=format&fit=crop';

      const sanitizedOptions = newServiceOptions.map(opt => {
        const rawPriceStr = opt.price.toString().replace(/[^0-9.]/g, '');
        const parsedNum = parseFloat(rawPriceStr);
        const includesArr = opt.includes
          ? (typeof opt.includes === 'string'
              ? opt.includes.split(',').map(s => s.trim()).filter(Boolean)
              : opt.includes)
          : [];

        return {
          ...opt,
          id: opt.id || `o_${Date.now()}`,
          name: opt.name.trim() || 'Opción',
          price: isNaN(parsedNum) ? 0 : parsedNum,
          description: opt.description?.trim() || '',
          duration: opt.duration?.trim() || '60 min',
          includes: includesArr
        };
      });

      const servicePayload = {
        category: selectedCategory,
        name: newServiceName.trim(),
        description: newServiceDesc.trim() || 'Servicio exclusivo Milibeauty',
        image_url: newServiceImageUrl.trim() || defaultImg,
        ...(editingServiceId ? {} : { order_index: services.length + 1 })
      };

      let newServiceId = editingServiceId;
      if (editingServiceId) {
        const { error } = await supabase.from('services').update(servicePayload).eq('id', editingServiceId);
        if (error) throw error;
        await supabase.from('service_options').delete().eq('service_id', editingServiceId);
      } else {
        const { data, error } = await supabase.from('services').insert(servicePayload).select().single();
        if (error || !data) throw error;
        newServiceId = data.id;
      }

      const optionsPayload = sanitizedOptions.map(opt => ({
        service_id: newServiceId,
        name: opt.name,
        price: opt.price,
        duration_minutes: parseInt(opt.duration) || 60
      }));

      if (optionsPayload.length > 0) {
        const { error } = await supabase.from('service_options').insert(optionsPayload);
        if (error) throw error;
      }

      setIsAddModalOpen(false);
      loadServices();
    } catch (err) {
      console.error('Error saving service:', err);
      alert('Error al guardar el servicio');
    } finally {
      setIsSavingService(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('¿Estás segura de eliminar este servicio?')) return;
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (!error) {
        loadServices();
      } else {
        throw error;
      }
    } catch (e) {
      console.error('Error deleting service:', e);
    }
  };

  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-serif italic mb-2">Gestor de Servicios</h2>
          <p className="text-brand-tertiary/60">Agrega, edita y arrastra para reordenar tus servicios.</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-primary text-white px-5 py-3 flex items-center gap-2 rounded-xl text-xs uppercase font-bold tracking-widest shadow-sm hover:opacity-95 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Agregar Servicio
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={services} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(service => (
              <SortableServiceItem
                key={service.id}
                service={service}
                onEdit={openEditModal}
                onDelete={handleDeleteService}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* MODAL: Agregar / Editar Servicio */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-brand-outline/10 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-brand-outline/10 pb-4">
              <div>
                <h3 className="text-xl font-serif italic">
                  {editingServiceId ? 'Editar Servicio' : 'Agregar Nuevo Servicio'}
                </h3>
                <p className="text-xs text-brand-tertiary/60">
                  {editingServiceId ? 'Modifica el nombre, detalles y precios de las opciones.' : 'Ingresa los datos del nuevo servicio para tu catálogo.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-brand-tertiary/60 hover:text-brand-tertiary hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Categoría selector (if not selected) */}
            {!selectedCategory ? (
              <div className="space-y-4">
                <p className="text-sm font-bold text-center text-brand-tertiary">
                  ¿Qué tipo de servicio vas a agregar?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('nails')}
                    className="p-6 rounded-2xl border-2 border-brand-outline/15 hover:border-brand-primary bg-brand-secondary/30 hover:bg-brand-primary/5 flex flex-col items-center text-center gap-3 transition-all group"
                  >
                    <span className="text-4xl group-hover:scale-110 transition-transform">💅</span>
                    <div>
                      <h4 className="font-bold text-base text-brand-tertiary group-hover:text-brand-primary">Uñas</h4>
                      <p className="text-xs text-brand-tertiary/60 mt-1">Manicura, pedicura, acrílicas, gel, kapping.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory('lashes')}
                    className="p-6 rounded-2xl border-2 border-brand-outline/15 hover:border-brand-primary bg-brand-secondary/30 hover:bg-brand-primary/5 flex flex-col items-center text-center gap-3 transition-all group"
                  >
                    <span className="text-4xl group-hover:scale-110 transition-transform">👁️</span>
                    <div>
                      <h4 className="font-bold text-base text-brand-tertiary group-hover:text-brand-primary">Cejas y Pestañas</h4>
                      <p className="text-xs text-brand-tertiary/60 mt-1">Lifting, extensiones, perfilado, laminado.</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Form */
              <form onSubmit={handleSaveService} className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
                  <span className="text-xs font-bold text-brand-primary flex items-center gap-2">
                    Categoría: {selectedCategory === 'nails' ? '💅 Uñas' : '👁️ Cejas y Pestañas'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    className="text-[11px] font-semibold text-brand-primary underline hover:opacity-80"
                  >
                    Cambiar
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-brand-tertiary/70">
                    Nombre del Servicio *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={selectedCategory === 'nails' ? 'Ej: Kapping Gel con Esmaltado' : 'Ej: Laminado de Cejas'}
                    value={newServiceName}
                    onChange={e => setNewServiceName(e.target.value)}
                    className="w-full bg-brand-secondary/30 p-2.5 rounded-xl border border-brand-outline/20 outline-none text-xs focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-brand-tertiary/70">
                    Descripción del Servicio
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Describe los beneficios o detalles técnica..."
                    value={newServiceDesc}
                    onChange={e => setNewServiceDesc(e.target.value)}
                    className="w-full bg-brand-secondary/30 p-2.5 rounded-xl border border-brand-outline/20 outline-none text-xs focus:border-brand-primary resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-brand-tertiary/70">
                    Imagen de Portada del Servicio
                  </label>

                  {newServiceImageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-brand-outline/20 group bg-gray-50 flex items-center justify-center">
                      <img
                        src={newServiceImageUrl}
                        alt="Portada del servicio"
                        className="w-full h-36 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                        <label className="bg-white text-brand-tertiary hover:text-brand-primary text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Cambiar Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 8 * 1024 * 1024) {
                                  alert('La imagen no debe superar los 8MB.');
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  if (typeof reader.result === 'string') {
                                    setNewServiceImageUrl(reader.result);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setNewServiceImageUrl('')}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Quitar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="border-2 border-dashed border-brand-outline/30 hover:border-brand-primary/60 bg-brand-secondary/20 hover:bg-brand-primary/5 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all group text-center">
                        <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                          <Upload className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-brand-tertiary group-hover:text-brand-primary">
                          Cargar foto desde tu dispositivo / ordenador
                        </p>
                        <p className="text-[10px] text-brand-tertiary/50 mt-0.5">
                          Haz clic para buscar en tus archivos (JPG, PNG, WEBP)
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 8 * 1024 * 1024) {
                                alert('La imagen no debe superar los 8MB.');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                if (typeof reader.result === 'string') {
                                  setNewServiceImageUrl(reader.result);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] text-brand-tertiary/50 uppercase font-bold shrink-0">O por URL:</span>
                        <input
                          type="url"
                          placeholder="https://ejemplo.com/imagen.jpg"
                          value={newServiceImageUrl}
                          onChange={e => setNewServiceImageUrl(e.target.value)}
                          className="flex-1 bg-brand-secondary/30 px-3 py-1.5 rounded-lg border border-brand-outline/20 outline-none text-xs focus:border-brand-primary"
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-brand-tertiary/50 mt-1">
                    Esta imagen servirá como la portada principal de este servicio.
                  </p>
                </div>

                {/* Options and prices with detailed modality descriptions */}
                <div className="space-y-3 pt-2 border-t border-brand-outline/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-brand-tertiary/70 block">
                        Modalidades, Precios y Detalles Específicos
                      </label>
                      <p className="text-[11px] text-brand-tertiary/50">Personaliza la descripción, duración e inclusiones de cada modalidad (Ej: Clásico vs Premium).</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs font-bold text-brand-primary flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Modalidad
                    </button>
                  </div>

                  <div className="space-y-3">
                    {newServiceOptions.map((opt, idx) => (
                      <div key={opt.id || idx} className="p-3.5 bg-brand-secondary/30 rounded-2xl border border-brand-outline/15 space-y-3">
                        {/* Row 1: Name, Price, Duration, Delete */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                          <div className="flex-1 min-w-[130px]">
                            <span className="text-[10px] font-bold text-brand-tertiary/60 uppercase block mb-1">
                              Modalidad / Variante *
                            </span>
                            <input
                              type="text"
                              required
                              placeholder="Ej: Clásico, Premium, VIP..."
                              value={opt.name}
                              onChange={e => handleUpdateOption(idx, 'name', e.target.value)}
                              className="w-full bg-white p-2 rounded-xl border border-brand-outline/20 text-xs font-bold outline-none focus:border-brand-primary"
                            />
                          </div>

                          <div className="w-28">
                            <span className="text-[10px] font-bold text-brand-tertiary/60 uppercase block mb-1">
                              Precio ($) *
                            </span>
                            <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-brand-outline/20 focus-within:border-brand-primary">
                              <span className="text-xs font-bold text-brand-primary">$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                required
                                placeholder="25"
                                value={opt.price}
                                onChange={e => handleUpdateOption(idx, 'price', e.target.value)}
                                className="w-full bg-transparent text-xs font-bold outline-none text-brand-tertiary"
                              />
                            </div>
                          </div>

                          <div className="w-28">
                            <span className="text-[10px] font-bold text-brand-tertiary/60 uppercase block mb-1">
                              Duración
                            </span>
                            <input
                              type="text"
                              placeholder="45 min"
                              value={opt.duration || ''}
                              onChange={e => handleUpdateOption(idx, 'duration', e.target.value)}
                              className="w-full bg-white p-2 rounded-xl border border-brand-outline/20 text-xs font-medium outline-none focus:border-brand-primary"
                            />
                          </div>

                          {newServiceOptions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(idx)}
                              className="p-2 mt-4 text-red-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                              title="Eliminar modalidad"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Row 2: Descripción específica de esta modalidad */}
                        <div>
                          <label className="text-[10px] font-bold text-brand-tertiary/60 uppercase block mb-1">
                            Descripción propia de la modalidad: {opt.name || 'Opción'}
                          </label>
                          <textarea
                            rows={2}
                            placeholder={`Describe los detalles específicos para la opción ${opt.name || ''}...`}
                            value={opt.description || ''}
                            onChange={e => handleUpdateOption(idx, 'description', e.target.value)}
                            className="w-full bg-white p-2.5 rounded-xl border border-brand-outline/20 text-xs outline-none focus:border-brand-primary resize-none"
                          />
                        </div>

                        {/* Row 3: Lo que incluye (Lista separada por comas) */}
                        <div>
                          <label className="text-[10px] font-bold text-brand-tertiary/60 uppercase block mb-1">
                            ¿Qué incluye {opt.name || 'esta modalidad'}? (Separados por coma)
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: Limpieza profunda, Nivelación Rubber, Esmaltado monocolor, Masaje"
                            value={opt.includes || ''}
                            onChange={e => handleUpdateOption(idx, 'includes', e.target.value)}
                            className="w-full bg-white p-2 rounded-xl border border-brand-outline/20 text-xs outline-none focus:border-brand-primary"
                          />
                        </div>

                        {/* Quick preset price helpers */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-brand-outline/10">
                          <span className="text-[10px] text-brand-tertiary/50 font-medium">Precios rápidos:</span>
                          {['15', '25', '35', '50', '75', '100'].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleUpdateOption(idx, 'price', preset)}
                              className="text-[10px] px-2 py-0.5 rounded bg-white hover:bg-brand-primary/10 border border-brand-outline/10 text-brand-tertiary/70 hover:text-brand-primary font-bold transition-colors"
                            >
                              ${preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-brand-outline/10">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-brand-outline/20 text-xs font-bold uppercase text-brand-tertiary/70 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingService}
                    className="bg-brand-primary text-white px-5 py-2.5 rounded-xl text-xs uppercase font-bold tracking-wider flex items-center gap-2 shadow-xs hover:opacity-95"
                  >
                    {isSavingService ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {editingServiceId ? 'Guardar Cambios' : 'Guardar Servicio'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableServiceItem({
  service,
  onEdit,
  onDelete
}: {
  service: Service;
  onEdit?: (service: Service) => void;
  onDelete?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: service.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('1:1');

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGenerating(true);
    try {
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: `A highly aesthetic, professional, elegant photography for a beauty salon. Service: ${service.name}. ${service.description}. Minimalist, luxury feel.`,
          aspectRatio 
        })
      });
      const data = await res.json();
      if (data.imageUrl) {
        await fetch(`/api/services/${service.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: data.imageUrl })
        });
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const categoryLabel = service.category === 'nails' ? '💅 Uñas' : '👁️ Cejas y Pestañas';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-2xl shadow-sm border border-brand-outline/15 overflow-hidden transition-all hover:shadow-md flex flex-col justify-between"
    >
      {/* Top Header Bar: Drag Handle + Category Tag */}
      <div className="bg-brand-secondary/40 px-4 py-2.5 border-b border-brand-outline/10 flex items-center justify-between">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center gap-2 px-2.5 py-1 bg-white hover:bg-brand-primary/10 rounded-lg text-brand-tertiary/70 hover:text-brand-primary cursor-grab active:cursor-grabbing touch-none transition-colors border border-brand-outline/15 shadow-2xs"
          title="Arrastrar para reordenar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="5" r="1"/>
            <circle cx="9" cy="12" r="1"/>
            <circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="5" r="1"/>
            <circle cx="15" cy="12" r="1"/>
            <circle cx="15" cy="19" r="1"/>
          </svg>
          <span className="text-[10px] font-bold tracking-wider uppercase">Reordenar</span>
        </div>

        <span className="text-[11px] bg-brand-primary/10 text-brand-primary font-bold px-3 py-1 rounded-full border border-brand-primary/20">
          {categoryLabel}
        </span>
      </div>

      {/* Card Content Body */}
      <div className="p-4 space-y-4 flex-1">
        {/* Row 1: Image, Name & Description */}
        <div className="flex gap-3.5 items-start">
          <img
            src={service.imageUrl}
            alt={service.name}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 border border-brand-outline/10 shadow-xs"
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-serif font-bold text-base text-brand-tertiary leading-tight mb-1">
              {service.name}
            </h4>
            <p className="text-xs text-brand-tertiary/70 line-clamp-2 leading-relaxed">
              {service.description}
            </p>
          </div>
        </div>

        {/* Row 2: Precios y Modalidades (Diferenciados con fondo suave) */}
        <div className="bg-brand-secondary/30 rounded-xl p-3 border border-brand-outline/10 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-tertiary/50 block">
            Modalidades y Precios
          </span>
          <div className="flex flex-wrap gap-2">
            {service.options?.map(opt => (
              <div
                key={opt.id}
                className="bg-white px-3 py-1.5 rounded-lg border border-brand-outline/15 flex items-center justify-between gap-3 text-xs shadow-2xs flex-1 min-w-[130px]"
              >
                <span className="font-medium text-brand-tertiary">{opt.name}</span>
                <span className="font-bold text-brand-primary text-sm">${opt.price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Generador de Imagen IA Compacto */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
          <span className="text-[11px] font-medium text-brand-tertiary/70 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-brand-primary" /> Imagen IA
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex text-[10px] border rounded-md overflow-hidden border-brand-outline/15 bg-white">
              <button
                className={`px-2 py-0.5 font-bold ${aspectRatio === '1:1' ? 'bg-brand-primary text-white' : 'text-brand-tertiary/70'}`}
                onClick={(e) => { e.stopPropagation(); setAspectRatio('1:1'); }}
              >
                1:1
              </button>
              <button
                className={`px-2 py-0.5 font-bold border-l border-brand-outline/15 ${aspectRatio === '4:3' ? 'bg-brand-primary text-white' : 'text-brand-tertiary/70'}`}
                onClick={(e) => { e.stopPropagation(); setAspectRatio('4:3'); }}
              >
                4:3
              </button>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-brand-primary hover:bg-brand-primary-light text-white text-[11px] px-3 py-1 rounded-lg flex items-center gap-1 font-bold shadow-2xs transition-all active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {isGenerating ? 'Generando...' : 'Generar'}
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons: Full Width, Large Touch Targets */}
      <div className="p-4 pt-0 grid grid-cols-2 gap-2.5">
        {onEdit && (
          <button
            onClick={() => onEdit(service)}
            className="w-full py-3 px-4 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-brand-primary/20"
          >
            <Pencil className="w-4 h-4" /> Editar
          </button>
        )}

        {onDelete && (
          <button
            onClick={() => onDelete(service.id)}
            className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-red-200"
          >
            <Trash2 className="w-4 h-4" /> Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------
// Schedule & Working Days Management Tab
// -----------------------------------------
function ScheduleTab() {
  const [schedule, setSchedule] = useState<any>({
    weeklySchedule: {
      0: { active: false, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      1: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      2: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      3: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      4: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      5: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      6: { active: true,  slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00"] },
    },
    blockedDates: [],
    blockedNotes: {},
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Selected day index for schedule editor (1 = Lunes)
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(1);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [isHoursExpanded, setIsHoursExpanded] = useState(true);

  // Form for blocking specific dates
  const [blockDateInput, setBlockDateInput] = useState('');
  const [blockNoteInput, setBlockNoteInput] = useState('');

  const dayNames = [
    { idx: 1, name: 'Lunes', short: 'Lun' },
    { idx: 2, name: 'Martes', short: 'Mar' },
    { idx: 3, name: 'Miércoles', short: 'Mié' },
    { idx: 4, name: 'Jueves', short: 'Jue' },
    { idx: 5, name: 'Viernes', short: 'Vie' },
    { idx: 6, name: 'Sábado', short: 'Sáb' },
    { idx: 0, name: 'Domingo', short: 'Dom' },
  ];

  const standardHours = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
  ];

  const fetchScheduleData = async () => {
    try {
      const { data: schedData, error: schedErr } = await supabase.from('schedules').select('*');
      if (schedErr) throw schedErr;
      
      const { data: blockData, error: blockErr } = await supabase.from('blocked_dates').select('*');
      if (blockErr) throw blockErr;

      const newWeekly: any = {};
      for (let i = 0; i < 7; i++) {
        newWeekly[i] = { active: false, slots: [] };
      }

      if (schedData && schedData.length > 0) {
        schedData.forEach((s: any) => {
          newWeekly[s.day_of_week] = {
            active: s.is_active,
            slots: s.slots || []
          };
        });
      } else {
        [1,2,3,4,5,6].forEach(d => {
           newWeekly[d] = { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] };
        });
      }

      const newBlockedDates = blockData.map((b: any) => b.date);
      const newBlockedNotes: any = {};
      blockData.forEach((b: any) => {
        newBlockedNotes[b.date] = b.reason;
      });

      setSchedule({
        weeklySchedule: newWeekly,
        blockedDates: newBlockedDates,
        blockedNotes: newBlockedNotes
      });
    } catch (e) {
      console.error('Error fetching schedules:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const upsertPayload = Object.keys(schedule.weeklySchedule).map(dayIdxStr => {
        const dayIdx = parseInt(dayIdxStr);
        return {
          day_of_week: dayIdx,
          is_active: schedule.weeklySchedule[dayIdx].active,
          slots: schedule.weeklySchedule[dayIdx].slots
        };
      });

      const { error } = await supabase.from('schedules').upsert(upsertPayload, { onConflict: 'day_of_week' });
      if (error) throw error;
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (e) {
      console.error('Error saving schedule:', e);
      alert('Error al guardar los horarios');
    } finally {
      setSaving(false);
    }
  };

  const toggleDayActive = (dayIdx: number) => {
    setSchedule((prev: any) => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [dayIdx]: {
          ...prev.weeklySchedule[dayIdx],
          active: !prev.weeklySchedule[dayIdx]?.active,
        }
      }
    }));
  };

  const toggleSlot = (dayIdx: number, slot: string) => {
    setSchedule((prev: any) => {
      const currentSlots: string[] = prev.weeklySchedule[dayIdx]?.slots || [];
      const exists = currentSlots.includes(slot);
      const updated = exists 
        ? currentSlots.filter(s => s !== slot).sort()
        : [...currentSlots, slot].sort();

      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [dayIdx]: {
            ...prev.weeklySchedule[dayIdx],
            slots: updated,
          }
        }
      };
    });
  };

  const addCustomSlot = (dayIdx: number) => {
    if (!customTimeInput.trim()) return;
    const timeFormatted = customTimeInput.trim();
    setSchedule((prev: any) => {
      const currentSlots: string[] = prev.weeklySchedule[dayIdx]?.slots || [];
      if (!currentSlots.includes(timeFormatted)) {
        const updated = [...currentSlots, timeFormatted].sort();
        return {
          ...prev,
          weeklySchedule: {
            ...prev.weeklySchedule,
            [dayIdx]: {
              ...prev.weeklySchedule[dayIdx],
              slots: updated,
            }
          }
        };
      }
      return prev;
    });
    setCustomTimeInput('');
  };

  const handleAddBlockedDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDateInput) return;

    const { error } = await supabase.from('blocked_dates').insert({
      date: blockDateInput,
      reason: blockNoteInput.trim() || 'Bloqueado por administración'
    });

    if (error) {
      if (error.code === '23505') {
        alert('Esa fecha ya está bloqueada.');
      } else {
        alert('Error al bloquear la fecha: ' + error.message);
      }
      return;
    }

    setSchedule((prev: any) => {
      const dates: string[] = prev.blockedDates || [];
      if (!dates.includes(blockDateInput)) {
        return {
          ...prev,
          blockedDates: [...dates, blockDateInput].sort(),
          blockedNotes: {
            ...prev.blockedNotes,
            [blockDateInput]: blockNoteInput.trim() || 'Bloqueado por administración',
          }
        };
      }
      return prev;
    });

    setBlockDateInput('');
    setBlockNoteInput('');
  };

  const handleRemoveBlockedDate = async (dateStr: string) => {
    const { error } = await supabase.from('blocked_dates').delete().eq('date', dateStr);
    if (error) {
      alert('Error al eliminar bloqueo: ' + error.message);
      return;
    }

    setSchedule((prev: any) => {
      const updatedDates = (prev.blockedDates || []).filter((d: string) => d !== dateStr);
      const updatedNotes = { ...prev.blockedNotes };
      delete updatedNotes[dateStr];
      return {
        ...prev,
        blockedDates: updatedDates,
        blockedNotes: updatedNotes,
      };
    });
  };

  const applyPresetHours = (dayIdx: number, preset: 'morning' | 'afternoon' | 'full' | 'clear') => {
    let slots: string[] = [];
    if (preset === 'morning') slots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];
    if (preset === 'afternoon') slots = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
    if (preset === 'full') slots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    
    setSchedule((prev: any) => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [dayIdx]: {
          ...prev.weeklySchedule[dayIdx],
          active: slots.length > 0,
          slots,
        }
      }
    }));
  };

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary mb-3" />
        <p className="text-sm text-brand-tertiary/60">Cargando configuración de horarios...</p>
      </div>
    );
  }

  const currentDayInfo = schedule.weeklySchedule?.[selectedDayIdx] || { active: true, slots: [] };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-primary text-white px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-all shrink-0 active:scale-95"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ¡Configuración de horarios y días bloqueados guardada con éxito!
        </div>
      )}

      {/* SECTION 1: Configuración de Días y Horarios Semanales */}
      <section className="bg-white p-6 rounded-2xl border border-brand-outline/10 shadow-xs space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-brand-outline/10">
          <Clock className="w-5 h-5 text-brand-primary" />
          <h3 className="font-serif italic text-xl">Horario Semanal Habitual</h3>
        </div>

        {/* Day Selector Tabs */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {dayNames.map(({ idx, name, short }) => {
            const dayData = schedule.weeklySchedule?.[idx];
            const isActive = dayData?.active;
            const isSelected = selectedDayIdx === idx;
            const slotCount = dayData?.slots?.length || 0;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => { setSelectedDayIdx(idx); setIsDayModalOpen(true); }}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between border-brand-outline/10 bg-brand-secondary/50 hover:bg-brand-secondary active:scale-95`}
              >
                <span className="text-xs font-bold">{short}</span>
                <span className={`text-[10px] mt-1.5 px-2 py-0.5 rounded-full font-semibold ${
                  isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
                }`}>
                  {isActive ? `${slotCount} turnos` : 'Cerrado'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Day Configuration Modal */}
        {isDayModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-brand-outline/10 p-4">
                <h4 className="font-bold flex items-center gap-2">
                  <span className="text-brand-primary font-serif italic text-xl">{dayNames.find(d => d.idx === selectedDayIdx)?.name}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsDayModalOpen(false)}
                  className="p-2 -mr-2 text-brand-tertiary/60 hover:text-brand-tertiary hover:bg-brand-secondary rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between border-b border-brand-outline/10 pb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-tertiary/70">
                    Estado del Día
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-tertiary/70">
                      {currentDayInfo.active ? 'Laboral' : 'Libre'}
                    </span>
                    <input
                      type="checkbox"
                      checked={currentDayInfo.active}
                      onChange={() => toggleDayActive(selectedDayIdx)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${currentDayInfo.active ? 'bg-brand-primary' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${currentDayInfo.active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </label>
                </div>

                {currentDayInfo.active ? (
                  <div className="space-y-4">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-brand-tertiary/70 mb-2">
                      Horarios de Atención
                    </h5>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {Array.from(new Set([...standardHours, ...(currentDayInfo.slots || [])])).sort().map(hour => {
                        const isSelected = currentDayInfo.slots?.includes(hour);
                        return (
                          <button
                            key={hour}
                            type="button"
                            onClick={() => toggleSlot(selectedDayIdx, hour)}
                            className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all border text-center ${
                              isSelected
                                ? 'bg-brand-tertiary text-white border-brand-tertiary shadow-2xs hover:bg-red-900/90'
                                : 'bg-white border-brand-outline/10 text-brand-tertiary/60 hover:border-brand-primary/40 hover:text-brand-primary'
                            }`}
                            title={isSelected ? `Eliminar ${hour}` : `Activar ${hour}`}
                          >
                            {formatTime12h(hour)}
                          </button>
                        );
                      })}
                    </div>

                    {/* Add Custom Hour Input */}
                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Otra hora (ej: 07:30)"
                        value={customTimeInput}
                        onChange={e => setCustomTimeInput(e.target.value)}
                        className="bg-white px-3 py-1.5 rounded-lg border border-brand-outline/20 text-[11px] outline-none focus:border-brand-primary w-36"
                      />
                      <button
                        type="button"
                        onClick={() => addCustomSlot(selectedDayIdx)}
                        className="bg-brand-primary text-white text-[11px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:opacity-90 transition-opacity"
                      >
                        <Plus className="w-3 h-3" /> Añadir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-brand-tertiary/40 py-8 italic">
                    Día marcado como no laboral. Actívalo para habilitar turnos.
                  </div>
                )}
              </div>

              <div className="p-4 bg-brand-secondary/30 border-t border-brand-outline/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsDayModalOpen(false)}
                  className="bg-brand-tertiary text-white px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:opacity-90"
                >
                  Hecho
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: Bloqueo de Días Especiales (Feriados / Vacaciones) */}
      <section className="bg-white p-6 rounded-2xl border border-brand-outline/10 shadow-xs space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-brand-outline/10">
          <CalendarX className="w-5 h-5 text-red-500" />
          <h3 className="font-serif italic text-xl">Bloqueo de Días Especiales</h3>
        </div>

        <p className="text-xs text-brand-tertiary/70">
          Selecciona fechas concretas en las que no habrá servicio (ej: vacaciones, feriados o compromisos personales) para evitar reservas esos días.
        </p>

        {/* Add Blocked Date Form */}
        <form onSubmit={handleAddBlockedDate} className="bg-brand-secondary/40 p-4 rounded-xl border border-brand-outline/10 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-tertiary/70">
                Fecha a Bloquear *
              </label>
              <input
                type="date"
                required
                value={blockDateInput}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setBlockDateInput(e.target.value)}
                className="w-full bg-white p-2.5 rounded-lg border border-brand-outline/20 outline-none text-xs focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-tertiary/70">
                Motivo u Observación (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. Feriado Nacional, Día de Entrenamiento"
                value={blockNoteInput}
                onChange={e => setBlockNoteInput(e.target.value)}
                className="w-full bg-white p-2.5 rounded-lg border border-brand-outline/20 outline-none text-xs focus:border-brand-primary"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <CalendarX className="w-3.5 h-3.5" /> Bloquear Fecha
            </button>
          </div>
        </form>

        {/* List of Blocked Dates */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-tertiary/70">
            Días Bloqueados Actualmente ({schedule.blockedDates?.length || 0}):
          </h4>

          {(!schedule.blockedDates || schedule.blockedDates.length === 0) ? (
            <div className="p-6 bg-brand-secondary/20 rounded-xl text-center text-xs text-brand-tertiary/50 border border-dashed border-brand-outline/20">
              No hay días bloqueados guardados. Utiliza el formulario arriba para agregar excepciones.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {schedule.blockedDates.map((dateStr: string) => {
                const note = schedule.blockedNotes?.[dateStr] || 'Bloqueado';
                const parts = dateStr.split('-');
                const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

                return (
                  <div key={dateStr} className="flex items-center justify-between p-3 bg-red-50/60 border border-red-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                        <CalendarX className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-red-900 block">{formattedDate}</span>
                        <span className="text-[11px] text-red-700/80">{note}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveBlockedDate(dateStr)}
                      className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                      title="Desbloquear fecha"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// -----------------------------------------
// Client Interface Tab
// -----------------------------------------
function ClientInterfaceTab() {
  const [categoryImages, setCategoryImages] = useState({
    nails: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop",
    lashes: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1000&auto=format&fit=crop"
  });

  const [siteConfig, setSiteConfig] = useState({
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
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState<'nails' | 'lashes' | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/categories/images')
      .then(res => res.json())
      .then(data => {
        if (data?.nails || data?.lashes) {
          setCategoryImages(prev => ({
            nails: data.nails || prev.nails,
            lashes: data.lashes || prev.lashes
          }));
        }
      })
      .catch(console.error);

    fetch('/api/site-config')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setSiteConfig(prev => ({ ...prev, ...data }));
        }
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const [resImg, resConfig] = await Promise.all([
        fetch('/api/categories/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(categoryImages)
        }),
        fetch('/api/site-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(siteConfig)
        })
      ]);

      if (resImg.ok && resConfig.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch (e) {
      console.error(e);
      alert('Error guardando los cambios de la interfaz');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateImage = async (category: 'nails' | 'lashes') => {
    setIsGenerating(category);
    try {
      const prompt = category === 'nails'
        ? "Luxury professional manicure nail art studio photography, clean aesthetic, high resolution aesthetic nails"
        : "Luxury lash lifting and eyebrow design studio portrait photography, elegant aesthetic, soft lighting";

      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: "16:9" })
      });

      const data = await res.json();
      if (data.imageUrl) {
        setCategoryImages(prev => ({ ...prev, [category]: data.imageUrl }));
      } else {
        alert('No se pudo generar la imagen. Puedes usar una URL directa.');
      }
    } catch (e) {
      console.error(e);
      alert('Error conectando con el servidor de IA.');
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-brand-tertiary text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-brand-tertiary/90 transition-colors shrink-0 shadow-sm"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Guardar Cambios</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2 border border-emerald-200 shadow-xs animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span><strong>¡Interfaz actualizada!</strong> Los cambios ya se reflejan en la pantalla de inicio de tus clientes.</span>
        </div>
      )}

      {/* Identidad del Estudio */}
      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs space-y-4">
        <h4 className="font-serif italic font-medium text-lg text-brand-tertiary border-b border-brand-outline/10 pb-3 flex items-center gap-2">
          <Pencil className="w-4 h-4 text-brand-primary" />
          Identidad y Bienvenida de la App
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
              Nombre del Estudio / App
            </label>
            <input
              type="text"
              value={siteConfig.studioName}
              onChange={e => setSiteConfig(prev => ({ ...prev, studioName: e.target.value }))}
              placeholder="Ej: Milibeauty"
              className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
              Subtítulo / Mensaje de Bienvenida
            </label>
            <input
              type="text"
              value={siteConfig.studioSubtitle}
              onChange={e => setSiteConfig(prev => ({ ...prev, studioSubtitle: e.target.value }))}
              placeholder="Ej: Estudio de lujo especializado..."
              className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Ubicación y Mapa ("Cómo llegar") */}
      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-outline/10 pb-3">
          <h4 className="font-serif italic font-medium text-lg text-brand-tertiary flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-primary" />
            Ubicación del Studio & Mapa ("Cómo llegar")
          </h4>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
            📍 Botón activo en Inicio y Confirmación de Citas
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
              Dirección Física Completa (Texto visible para la cliente)
            </label>
            <input
              type="text"
              value={siteConfig.studioAddress || ''}
              onChange={e => setSiteConfig(prev => ({ ...prev, studioAddress: e.target.value }))}
              placeholder="Ej: Av. Principal Las Mercedes, Edificio Centro Empresarial, Piso 3, Local 302"
              className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white"
            />
            <p className="text-[11px] text-brand-tertiary/60 mt-1">
              Esta dirección es la que leen tus clientes y la que se copia al tocar "Copiar dirección".
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider">
                Enlace de Google Maps / Apple Maps / Waze
              </label>
              <button
                type="button"
                onClick={() => {
                  const autoUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((siteConfig.studioName || 'Milibeauty') + ' ' + (siteConfig.studioAddress || ''))}`;
                  setSiteConfig(prev => ({ ...prev, mapsUrl: autoUrl }));
                }}
                className="text-[11px] font-bold text-brand-primary hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Generar Link de Google Maps Automático
              </button>
            </div>
            <input
              type="text"
              value={siteConfig.mapsUrl || ''}
              onChange={e => setSiteConfig(prev => ({ ...prev, mapsUrl: e.target.value }))}
              placeholder="https://www.google.com/maps/search/?api=1&query=..."
              className="w-full px-3.5 py-2.5 text-xs bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white font-mono"
            />
          </div>

          {/* Preview and Test Buttons */}
          <div className="bg-brand-secondary/40 p-4 rounded-xl border border-brand-outline/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-brand-tertiary/80 space-y-0.5">
              <p className="font-semibold text-brand-tertiary">📍 Vista Previa del Botón de la Cliente:</p>
              <p className="text-[11px] text-brand-tertiary/60">
                Al pulsar "¿Cómo Llegar?", la cliente podrá elegir entre Google Maps, Apple Maps e iOS Maps.
              </p>
            </div>

            {siteConfig.mapsUrl && (
              <a
                href={siteConfig.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-brand-tertiary hover:bg-brand-tertiary/90 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Probar Enlace de Mapa</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Portadas Principales (Manicure & Cejas/Pestañas) */}
      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs space-y-5">
        <h4 className="font-serif italic font-medium text-lg text-brand-tertiary border-b border-brand-outline/10 pb-3 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-brand-primary" />
          Tarjetas de Portada (Pantalla Principal)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Manicure Section */}
          <div className="space-y-4 bg-brand-secondary/30 p-5 rounded-2xl border border-brand-outline/10 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h5 className="font-serif italic font-medium text-base text-brand-tertiary">💅 Categoría Manicure</h5>
                <button
                  type="button"
                  onClick={() => handleGenerateImage('nails')}
                  disabled={isGenerating === 'nails'}
                  className="text-xs text-brand-primary font-bold flex items-center gap-1.5 hover:underline disabled:opacity-50 bg-brand-primary/10 px-3 py-1.5 rounded-lg"
                >
                  {isGenerating === 'nails' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generar con IA
                    </>
                  )}
                </button>
              </div>

              {/* Real time preview card */}
              <div className="relative h-40 rounded-xl overflow-hidden shadow-sm border border-brand-outline/10 group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />
                <img 
                  src={categoryImages.nails} 
                  alt="Preview Manicure" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-0 left-0 p-4 z-20 w-full">
                  <span className="text-brand-primary-light text-[10px] font-semibold uppercase tracking-widest block">
                    {siteConfig.nailsTag || "Especialidad"}
                  </span>
                  <h6 className="text-white text-xl font-serif italic font-medium">{siteConfig.nailsTitle || "Manicure"}</h6>
                  <p className="text-white/80 text-[11px] mt-0.5 line-clamp-1">{siteConfig.nailsDescription}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
                    URL de la Imagen de Fondo
                  </label>
                  <input
                    type="text"
                    value={categoryImages.nails}
                    onChange={e => setCategoryImages(prev => ({ ...prev, nails: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 text-xs bg-white border border-brand-outline/10 rounded-lg outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-brand-tertiary/60 tracking-wider block mb-0.5">Título</label>
                    <input
                      type="text"
                      value={siteConfig.nailsTitle}
                      onChange={e => setSiteConfig(prev => ({ ...prev, nailsTitle: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-brand-outline/10 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-brand-tertiary/60 tracking-wider block mb-0.5">Etiqueta</label>
                    <input
                      type="text"
                      value={siteConfig.nailsTag}
                      onChange={e => setSiteConfig(prev => ({ ...prev, nailsTag: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-brand-outline/10 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-tertiary/60 tracking-wider block mb-0.5">Descripción Corta</label>
                  <input
                    type="text"
                    value={siteConfig.nailsDescription}
                    onChange={e => setSiteConfig(prev => ({ ...prev, nailsDescription: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-brand-outline/10 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cejas y Pestañas Section */}
          <div className="space-y-4 bg-brand-secondary/30 p-5 rounded-2xl border border-brand-outline/10 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h5 className="font-serif italic font-medium text-base text-brand-tertiary">👁️ Categoría Cejas & Pestañas</h5>
                <button
                  type="button"
                  onClick={() => handleGenerateImage('lashes')}
                  disabled={isGenerating === 'lashes'}
                  className="text-xs text-brand-primary font-bold flex items-center gap-1.5 hover:underline disabled:opacity-50 bg-brand-primary/10 px-3 py-1.5 rounded-lg"
                >
                  {isGenerating === 'lashes' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generar con IA
                    </>
                  )}
                </button>
              </div>

              {/* Real time preview card */}
              <div className="relative h-40 rounded-xl overflow-hidden shadow-sm border border-brand-outline/10 group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />
                <img 
                  src={categoryImages.lashes} 
                  alt="Preview Cejas y Pestañas" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-0 left-0 p-4 z-20 w-full">
                  <span className="text-brand-primary-light text-[10px] font-semibold uppercase tracking-widest block">
                    {siteConfig.lashesTag || "Especialidad"}
                  </span>
                  <h6 className="text-white text-xl font-serif italic font-medium">{siteConfig.lashesTitle || "Cejas y Pestañas"}</h6>
                  <p className="text-white/80 text-[11px] mt-0.5 line-clamp-1">{siteConfig.lashesDescription}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
                    URL de la Imagen de Fondo
                  </label>
                  <input
                    type="text"
                    value={categoryImages.lashes}
                    onChange={e => setCategoryImages(prev => ({ ...prev, lashes: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 text-xs bg-white border border-brand-outline/10 rounded-lg outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-brand-tertiary/60 tracking-wider block mb-0.5">Título</label>
                    <input
                      type="text"
                      value={siteConfig.lashesTitle}
                      onChange={e => setSiteConfig(prev => ({ ...prev, lashesTitle: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-brand-outline/10 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-brand-tertiary/60 tracking-wider block mb-0.5">Etiqueta</label>
                    <input
                      type="text"
                      value={siteConfig.lashesTag}
                      onChange={e => setSiteConfig(prev => ({ ...prev, lashesTag: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-brand-outline/10 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-tertiary/60 tracking-wider block mb-0.5">Descripción Corta</label>
                  <input
                    type="text"
                    value={siteConfig.lashesDescription}
                    onChange={e => setSiteConfig(prev => ({ ...prev, lashesDescription: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-brand-outline/10 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs space-y-4">
        <h4 className="font-serif italic font-medium text-lg text-brand-tertiary border-b border-brand-outline/10 pb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-brand-primary" />
          Sellos de Confianza (Pie de Inicio)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
              Sello 1 (⭐ Estrella)
            </label>
            <input
              type="text"
              value={siteConfig.badge1}
              onChange={e => setSiteConfig(prev => ({ ...prev, badge1: e.target.value }))}
              className="w-full px-3.5 py-2 text-xs bg-brand-secondary/30 border border-brand-outline/10 rounded-xl"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
              Sello 2 (⏰ Reloj)
            </label>
            <input
              type="text"
              value={siteConfig.badge2}
              onChange={e => setSiteConfig(prev => ({ ...prev, badge2: e.target.value }))}
              className="w-full px-3.5 py-2 text-xs bg-brand-secondary/30 border border-brand-outline/10 rounded-xl"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
              Sello 3 (🛡️ Escudo)
            </label>
            <input
              type="text"
              value={siteConfig.badge3}
              onChange={e => setSiteConfig(prev => ({ ...prev, badge3: e.target.value }))}
              className="w-full px-3.5 py-2 text-xs bg-brand-secondary/30 border border-brand-outline/10 rounded-xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
