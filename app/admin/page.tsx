"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Settings,
  Sparkles,
  Plus,
  Loader2,
  ArrowLeft,
  Lock,
  Clock,
  CalendarX,
  Check,
  Trash2,
  Save,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Upload,
  Image as ImageIcon,
  Star,
  List,
  Bell,
  Volume2,
  VolumeX,
  Smartphone,
  Send,
  CheckCircle,
  RefreshCw,
  MapPin,
  Navigation,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";
import { formatTime12h } from "@/lib/timeFormat";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Service } from "@/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import { es } from "date-fns/locale";

export default function AdminPage() {
  const router = useRouter();
  const { user, isAdmin, isAuthLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"schedule" | "calendar" | "services" | "interface" | "notifications">("schedule");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<string>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );
  const [webhookUrl, setWebhookUrl] = useState("");
  const [whatsappAlertPhone, setWhatsappAlertPhone] = useState("+584120574955");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    fetch("/api/notification-settings")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
          if (data.whatsappNumber) setWhatsappAlertPhone(data.whatsappNumber);
        }
      })
      .catch(() => {});

    let knownIds = new Set<string>();

    const fetchNotifs = () => {
      fetch("/api/notifications")
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount || 0);
            data.notifications.forEach((n: any) => knownIds.add(n.id));
          }
        })
        .catch(() => {});
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 4000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleMarkAllRead = () => {
    fetch("/api/notifications/mark-read", { method: "POST" }).then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    });
  };

  const handleMarkOneRead = (id: string) => {
    fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then(() => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });
  };

  const handleDeleteNotif = (id: string) => {
    fetch(`/api/notifications/${id}`, { method: "DELETE" }).then(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    });
  };

  const handleSaveNotifSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    fetch("/api/notification-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl, whatsappNumber: whatsappAlertPhone }),
    })
      .then(() => {
        setIsSavingSettings(false);
        alert("Configuración de notificaciones guardada exitosamente.");
      })
      .catch(() => setIsSavingSettings(false));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert("Error al iniciar sesión: " + error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Navegación de no-admin como efecto secundario (no durante el render).
  // Evita el warning de React: "Cannot update a component while rendering a different component".
  useEffect(() => {
    if (!isAuthLoading && user && !isAdmin) {
      router.replace("/");
    }
  }, [user, isAdmin, isAuthLoading, router]);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (user && !isAdmin) {
    return null;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-5 bg-brand-secondary relative">
        <button onClick={() => router.back()} className="absolute top-5 left-5 p-2 text-brand-tertiary">
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
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-brand-secondary rounded-xl border border-brand-outline/10 outline-none text-sm focus:border-brand-primary"
              required
            />
            <input
              type="password"
              placeholder="Contraseña de administrador"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

  const navTabs = [
    { id: "schedule", label: "Horarios", icon: Clock },
    { id: "calendar", label: "Citas", icon: Calendar },
    { id: "notifications", label: "Alertas", icon: Bell, badge: unreadCount },
    { id: "services", label: "Servicios", icon: Sparkles },
    { id: "interface", label: "Ajustes", icon: ImageIcon },
  ];

  const tabContent = (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.995 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full gpu-layer"
      >
        {activeTab === "calendar" && <CalendarTab />}
        {activeTab === "schedule" && <ScheduleTab />}
        {activeTab === "notifications" && (
          <NotificationsTab
            notifications={notifications}
            unreadCount={unreadCount}
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
        {activeTab === "services" && <ServicesTab />}
        {activeTab === "interface" && <ClientInterfaceTab />}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div className="w-full min-h-screen bg-brand-secondary">
      {/* ── MOBILE LAYOUT (< md) ── */}
      <div className="md:hidden min-h-screen w-full bg-[#d4d4d8]/40 flex justify-center">
        {/* NATIVE MOBILE FRAME */}
        <div className="w-full max-w-[430px] min-h-screen bg-brand-secondary text-brand-tertiary flex flex-col relative shadow-2xl border-x border-brand-outline/30 pb-28">
          
          {/* Mobile App Header */}
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-2xl border-b border-white/50 px-4 py-3.5 flex justify-between items-center shadow-[0_2px_12px_rgba(0,0,0,0.03)] gpu-layer">
            <div className="flex items-center gap-2.5">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                onClick={() => router.push('/')} 
                className="p-2 bg-brand-secondary/70 rounded-xl text-brand-tertiary border border-brand-outline/30 shadow-xs"
                title="Volver a la Web"
              >
                <ArrowLeft className="w-4 h-4" />
              </motion.button>
              <div>
                <h2 className="font-serif italic text-base font-bold leading-tight">Milibeauty Admin</h2>
                <p className="text-[10px] text-brand-primary font-semibold uppercase tracking-wider">Gestión del Studio</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                onClick={() => setActiveTab('notifications')}
                className="relative p-2 bg-brand-secondary/70 rounded-xl text-brand-tertiary border border-brand-outline/30 shadow-xs"
              >
                <Bell className="w-4 h-4 text-brand-primary" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleLogout} 
                className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl shadow-xs"
              >
                Salir
              </motion.button>
            </div>
          </header>

          {/* Tab Body */}
          <main className="p-3.5 w-full flex-1 overflow-y-auto">
            {tabContent}
          </main>

          {/* ── Fixed Floating Capsule Bottom Navigation ── */}
          <nav
            aria-label="Navegación Móvil Admin"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-[400px] gpu-layer"
          >
            <div className="glass-capsule rounded-3xl p-1.5 flex items-center justify-around relative touch-none select-none">
              {navTabs.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.90 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25, mass: 0.5 }}
                    onClick={() => setActiveTab(tab.id as any)}
                    aria-label={tab.label}
                    title={tab.label}
                    className={`relative flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-2xl transition-colors duration-200 z-10 ${
                      active ? 'text-white font-semibold' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="activeAdminNativePill"
                        className="absolute inset-0 gold-gradient-pill rounded-2xl"
                        initial={false}
                        transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
                        style={{ zIndex: -1 }}
                      />
                    )}
                    <div className="relative flex items-center gap-1">
                      <Icon className="w-4.5 h-4.5 stroke-[1.75]" />
                      {tab.badge && tab.badge > 0 ? (
                        <span className={`absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] ${active ? 'bg-white text-[#C5A065]' : 'bg-rose-500 text-white'} font-bold text-[9px] rounded-full flex items-center justify-center shadow-xs`}>
                          {tab.badge > 9 ? '9+' : tab.badge}
                        </span>
                      ) : null}
                      <AnimatePresence mode="wait">
                        {active && (
                          <motion.span
                            initial={{ opacity: 0, width: 0, scale: 0.9 }}
                            animate={{ opacity: 1, width: 'auto', scale: 1 }}
                            exit={{ opacity: 0, width: 0, scale: 0.9 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            className="text-[11.5px] font-bold tracking-tight whitespace-nowrap overflow-hidden"
                          >
                            {tab.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* ── DESKTOP LAYOUT (>= md) ── */}
      <div className="hidden md:flex min-h-screen flex-col md:flex-row bg-brand-secondary text-brand-tertiary w-full">
        <aside className="w-64 bg-white border-r border-brand-outline/10 flex flex-col shrink-0 sticky top-0 h-screen shadow-[1px_0_12px_rgba(0,0,0,0.02)]">
          <div className="p-6 border-b border-brand-outline/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.1, x: -2 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => router.push('/')}
                className="p-1.5 -ml-2 text-brand-tertiary hover:bg-brand-secondary rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
              <h2 className="font-serif italic text-2xl font-normal tracking-tight">Milibeauty</h2>
            </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            {navTabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <motion.button
                  key={`desktop-${tab.id}`}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full relative flex items-center justify-between px-4 py-3 rounded-2xl font-medium transition-colors z-10 text-left select-none ${
                    active ? "text-white font-bold" : "text-stone-700 hover:text-stone-950 hover:bg-brand-secondary/60"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="activeDesktopAdminNavIndicator"
                      className="absolute inset-0 gold-gradient-pill rounded-2xl"
                      transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <div className="flex items-center gap-3 relative z-10">
                    <Icon className="w-5 h-5 stroke-[1.75]" />
                    <span className="text-sm font-semibold">{tab.label}</span>
                  </div>
                  {tab.badge && tab.badge > 0 ? (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full relative z-10 shadow-xs ${active ? "bg-white text-[#C5A065]" : "bg-rose-500 text-white"}`}>
                      {tab.badge}
                    </span>
                  ) : null}
                </motion.button>
              );
            })}
          </nav>
          
          <div className="p-4 border-t border-brand-outline/10">
            <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-xs uppercase tracking-wider font-bold text-red-600/80 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors">
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 pb-10">
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-brand-outline/10 p-4 flex justify-end items-center shadow-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("notifications")}
                className="relative p-2 text-brand-tertiary hover:bg-brand-secondary rounded-xl transition-colors"
              >
                <Bell className="w-5 h-5 text-amber-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button onClick={handleLogout} className="text-sm font-semibold text-brand-tertiary/80 hover:text-brand-tertiary">
                Salir
              </button>
            </div>
          </header>

          <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto overflow-hidden">
            {tabContent}
          </div>
        </main>
      </div>
    </div>
  );
}

// Notifications Tab
function NotificationsTab({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkOneRead,
  onDeleteNotif,
  webhookUrl,
  setWebhookUrl,
  whatsappAlertPhone,
  setWhatsappAlertPhone,
  onSaveSettings,
  isSavingSettings,
}: {
  notifications: any[];
  unreadCount: number;
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
      <div className="bg-white p-6 rounded-3xl border border-brand-outline/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-6 h-6 text-amber-500 animate-bounce" />
            <h2 className="text-2xl font-serif italic text-brand-tertiary">Notificaciones de Citas (Solo Admin)</h2>
          </div>
          <p className="text-xs text-brand-tertiary/70">
            Recibe avisos flotantes e inmediatos en tu dispositivo al instante en que una cliente agende una cita.
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

      <form onSubmit={onSaveSettings} className="bg-white p-6 rounded-3xl border border-brand-outline/10 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-brand-outline/10">
          <Send className="w-5 h-5 text-blue-500" />
          <h3 className="font-bold text-sm text-brand-tertiary">Notificaciones 24/7 (Webhook / WhatsApp)</h3>
        </div>
        <div>
          <label className="text-[11px] font-bold text-brand-tertiary/60 uppercase block mb-1">Teléfono Admin para WhatsApp Directo</label>
          <input
            type="text"
            placeholder="+584120574955"
            value={whatsappAlertPhone}
            onChange={(e) => setWhatsappAlertPhone(e.target.value)}
            className="w-full bg-brand-secondary/40 p-2.5 rounded-xl border border-brand-outline/20 text-xs font-semibold outline-none focus:border-brand-primary"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-brand-tertiary/60 uppercase block mb-1">Webhook URL (Opcional)</label>
          <input
            type="url"
            placeholder="https://hooks.zapier.com/hooks/catch/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
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

      <div className="bg-white rounded-3xl border border-brand-outline/10 overflow-hidden shadow-sm">
        <div className="p-5 bg-brand-secondary/40 border-b border-brand-outline/10 flex items-center justify-between">
          <h3 className="font-serif italic text-lg text-brand-tertiary">Historial de Notificaciones ({notifications.length})</h3>
          <span className="text-xs font-bold px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-xl">{unreadCount} sin leer</span>
        </div>
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-brand-tertiary/50 space-y-2">
            <Bell className="w-10 h-10 mx-auto text-brand-tertiary/30" />
            <p className="text-xs font-medium">No hay notificaciones recibidas aún.</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-outline/10">
            {notifications.map((n) => (
              <div key={n.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${!n.read ? "bg-amber-50/60 font-medium" : "hover:bg-brand-secondary/30"}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />}
                    <h4 className="text-xs font-bold text-brand-tertiary">{n.title}</h4>
                    <span className="text-[10px] text-brand-tertiary/50">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-brand-tertiary/80">{n.message}</p>
                  {n.clientPhone && (
                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={`https://wa.me/${n.clientPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hola ${n.clientName}, recibimos tu cita para el ${n.date} a las ${formatTime12h(n.time)} en MiliBeauty.`)}`}
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

// Calendar Tab
function CalendarTab() {
  const [events, setEvents] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  const loadData = async () => {
    setLoading(true);
    let calendarData: any[] = [];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/calendar/events", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      calendarData = await res.json();
    } catch (e) {}

    let bookingsData: any[] = [];
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`*, services ( name ), service_options ( name, price, duration_minutes )`);

      if (!error && data) {
        bookingsData = data.map((b: any) => {
          const startDate = new Date(b.start_time);
          const dateStr = format(startDate, "yyyy-MM-dd");
          const timeStr = format(startDate, "HH:mm");
          return {
            id: b.id,
            date: dateStr,
            time: timeStr,
            clientName: b.client_name,
            clientPhone: b.client_phone,
            serviceName: b.services?.name || "Servicio Eliminado",
            optionName: b.service_options?.name || "",
            price: b.service_options?.price || 0,
            status: b.status,
            paymentMethod: "N/A",
            googleEventId: b.google_event_id,
          };
        });
      }
    } catch (e) {
      console.error("Error fetching bookings:", e);
    }

    try {
      const { data: bData } = await supabase.from("blocked_dates").select("*");
      if (bData) setBlockedDates(bData);
    } catch (e) {
      console.error("Error fetching blocked dates:", e);
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
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (!error) {
        setBookings((prev) => prev.filter((b) => b.id !== id));
      } else {
        alert("Error al eliminar la reserva");
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const selectedDayBookings = bookings.filter((b) => b.date === selectedDateStr);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-brand-outline/10 shadow-sm">
        <div>
          <h2 className="text-2xl font-serif italic text-brand-tertiary">Calendario de la Plataforma</h2>
          <p className="text-xs text-brand-tertiary/60">Gestiona las citas agendadas y consulta la sincronización con Google Calendar.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-brand-secondary p-1 rounded-xl border border-brand-outline/10">
            <button
              onClick={() => setViewMode("calendar")}
              title="Vista Calendario"
              className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${viewMode === "calendar" ? "bg-brand-primary text-white shadow-xs" : "text-brand-tertiary hover:text-brand-primary hover:bg-white/50"}`}
            >
              <Calendar className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title={`Vista Lista (${bookings.length} citas)`}
              className={`p-2.5 rounded-lg transition-all flex items-center justify-center relative ${viewMode === "list" ? "bg-brand-primary text-white shadow-xs" : "text-brand-tertiary hover:text-brand-primary hover:bg-white/50"}`}
            >
              <List className="w-5 h-5" />
              {bookings.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-brand-tertiary font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-white">
                  {bookings.length}
                </span>
              )}
            </button>
          </div>
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

      {viewMode === "calendar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-brand-outline/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-brand-outline/10">
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-brand-secondary rounded-xl text-brand-tertiary transition-colors" title="Mes anterior">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-serif italic capitalize text-brand-tertiary">{format(currentMonth, "MMMM yyyy", { locale: es })}</h3>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-brand-secondary rounded-xl text-brand-tertiary transition-colors" title="Mes siguiente">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}
                className="px-3 py-1.5 bg-brand-secondary hover:bg-brand-primary/10 text-brand-tertiary text-xs font-bold rounded-xl transition-colors border border-brand-outline/10"
              >
                Hoy
              </button>
            </div>
            <div className="grid grid-cols-7 text-center gap-1">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d} className="text-[11px] font-bold text-brand-tertiary/50 uppercase py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const isCurrent = isSameMonth(day, currentMonth);
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const dayBookings = bookings.filter((b) => b.date === dateStr);
                const count = dayBookings.length;
                const isBlocked = blockedDates.some((b) => b.date === dateStr);
                const blockInfo = blockedDates.find((b) => b.date === dateStr);

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[72px] p-1.5 rounded-xl border flex flex-col justify-between text-left transition-all relative ${
                      isSelected
                        ? "bg-brand-tertiary text-white border-brand-tertiary shadow-md ring-2 ring-brand-primary"
                        : isBlocked
                        ? "bg-red-50/80 text-red-900 border-red-200"
                        : isTodayDate
                        ? "bg-brand-primary/10 text-brand-tertiary border-brand-primary font-bold"
                        : !isCurrent
                        ? "bg-gray-50/50 text-gray-300 border-gray-100 opacity-60"
                        : "bg-white text-brand-tertiary border-brand-outline/10 hover:border-brand-primary/40 hover:bg-brand-secondary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isSelected ? "text-white" : ""}`}>{format(day, "d")}</span>
                      {isTodayDate && !isSelected && <span className="text-[8px] font-bold text-brand-primary uppercase">Hoy</span>}
                      {isBlocked && !isSelected && <span className="text-[8px] font-bold text-red-600 uppercase" title={blockInfo?.reason || "Bloqueado"}>⛔</span>}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {isBlocked && (
                        <span className={`text-[8px] font-bold px-1 py-0.2 rounded-sm block text-center truncate ${isSelected ? "bg-red-900/80 text-white" : "bg-red-100 text-red-700"}`}>
                          Bloqueado
                        </span>
                      )}
                      {count > 0 && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md block text-center truncate ${isSelected ? "bg-amber-300 text-brand-tertiary font-extrabold" : "bg-brand-primary text-white shadow-2xs"}`}>
                          {count} {count === 1 ? "Cita" : "Citas"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-brand-outline/10 shadow-sm flex flex-col">
            <div className="pb-3 border-b border-brand-outline/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-brand-tertiary/50 uppercase block">Citas Agendadas</span>
                <h3 className="text-lg font-serif italic text-brand-tertiary capitalize">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {blockedDates.some((b) => b.date === selectedDateStr) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-lg">
                    ⛔ Día Bloqueado
                  </span>
                )}
                <span className="text-xs font-bold px-2.5 py-1 bg-brand-primary/10 text-brand-primary rounded-xl">
                  {selectedDayBookings.length} {selectedDayBookings.length === 1 ? "Cita" : "Citas"}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto mt-4 space-y-3 max-h-[420px] pr-1">
              {blockedDates.some((b) => b.date === selectedDateStr) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800">
                  <CalendarX className="w-4 h-4 text-red-600 shrink-0" />
                  <div>
                    <span className="font-bold block">Día marcado como Bloqueado</span>
                    <span className="text-[11px] text-red-600">
                      {blockedDates.find((b) => b.date === selectedDateStr)?.reason || "No se permiten reservas este día."}
                    </span>
                  </div>
                </div>
              )}
              {selectedDayBookings.length === 0 ? (
                <div className="text-center py-12 px-4 text-brand-tertiary/50 bg-brand-secondary/30 rounded-2xl border border-dashed border-brand-outline/20">
                  <CalendarX className="w-8 h-8 mx-auto mb-2 text-brand-tertiary/30" />
                  <p className="text-xs font-medium">No hay citas agendadas en la plataforma para este día.</p>
                </div>
              ) : (
                selectedDayBookings.map((b) => (
                  <div key={b.id} className="p-3.5 bg-brand-secondary/40 rounded-2xl border border-brand-outline/15 space-y-2 hover:bg-brand-secondary/70 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-brand-tertiary">{b.clientName}</span>
                        <a
                          href={`https://wa.me/${b.clientPhone.replace(/[^0-9]/g, "")}`}
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
                      <p><strong>Servicio:</strong> {b.serviceName || "Servicio"} ({b.optionName || "Opción"})</p>
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
        <div className="bg-white rounded-2xl border border-brand-outline/10 overflow-hidden shadow-sm">
          <div className="p-4 bg-brand-secondary/40 border-b border-brand-outline/10 flex items-center justify-between">
            <h3 className="font-serif italic text-lg text-brand-tertiary">Todas las Citas Agendadas ({bookings.length})</h3>
          </div>
          {bookings.length === 0 ? (
            <div className="p-10 text-center text-brand-tertiary/50">No hay reservas en la plataforma.</div>
          ) : (
            <div className="divide-y divide-brand-outline/10">
              {bookings.map((b) => (
                <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-brand-secondary/40 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-tertiary">{b.clientName}</span>
                      <a
                        href={`https://wa.me/${b.clientPhone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        💬 {b.clientPhone}
                      </a>
                    </div>
                    <p className="text-xs text-brand-tertiary/80">
                      <strong>Servicio:</strong> {b.serviceName || "Servicio"} - {b.optionName || "Opción"} (€${b.price})
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

      {showGoogleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-brand-outline/20 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-brand-outline/10">
              <div className="flex items-center gap-2 text-brand-tertiary">
                <Calendar className="w-5 h-5 text-brand-primary" />
                <h3 className="text-xl font-serif italic">Eventos Sincronizados de Google Calendar</h3>
              </div>
              <button onClick={() => setShowGoogleModal(false)} className="p-1.5 text-brand-tertiary/50 hover:text-brand-tertiary hover:bg-brand-secondary rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-brand-outline/10 pr-1">
              {events.length === 0 ? (
                <div className="p-8 text-center text-brand-tertiary/50">No hay eventos próximos sincronizados en Google Calendar.</div>
              ) : (
                events.map((e: any) => (
                  <div key={e.id} className="py-3 flex items-start justify-between gap-3 hover:bg-brand-secondary/30 px-2 rounded-xl">
                    <div>
                      <h4 className="font-bold text-xs text-brand-tertiary">{e.summary || "Cita / Evento sin título"}</h4>
                      {e.description && <p className="text-[11px] text-brand-tertiary/60 mt-0.5">{e.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-brand-primary">{new Date(e.start.dateTime || e.start.date).toLocaleDateString()}</p>
                      <p className="text-[10px] text-brand-tertiary/60">
                        {new Date(e.start.dateTime || e.start.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="pt-3 border-t border-brand-outline/10 flex items-center justify-between">
              <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" /> Abrir Google Calendar Web
              </a>
              <button onClick={() => setShowGoogleModal(false)} className="px-4 py-2 bg-brand-tertiary text-white font-bold rounded-xl text-xs">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Services Tab
// ──────────────────────────────────────────────────────────────
// Helper compartido: sube una imagen al bucket de Supabase Storage
// y devuelve la URL pública. Usa el bucket público "lookbook-images"
// (con política de INSERT para usuarios autenticados/admins).
async function uploadImageToBucket(file: File, folder: string): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png";
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const BUCKET = "lookbook-images";

  let { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
    cacheControl: "3600",
    upsert: false,
  });

  // Si el bucket no existe, intentar crearlo y reintentar
  if (error && (error.message?.toLowerCase().includes("bucket not found") || (error as any)?.statusCode === 404 || (error as any)?.error === "Bucket not found")) {
    console.warn(`[Admin] Bucket "${BUCKET}" no encontrado. Intentando crear...`);
    const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5242880, // 5 MB
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
    });

    if (bucketError && !bucketError.message?.toLowerCase().includes("already exists")) {
      console.error(`[Admin] No se pudo crear el bucket "${BUCKET}":`, bucketError);
      console.error("ℹ️ Solución: Ejecuta el script supabase/create_lookbook_bucket.sql en tu panel de Supabase.");
      return null;
    }

    const retryResult = await supabase.storage.from(BUCKET).upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });
    error = retryResult.error;
  }

  if (error) {
    console.error("[Admin] Error al subir imagen:", error.message);
    return null;
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return publicUrlData?.publicUrl || null;
}

// Forma interna de una opción/modalidad de servicio en el formulario
interface ServiceOptionForm {
  id?: string;
  name: string;
  price: string;
  duration_minutes: string;
  description: string;
}

function ServicesTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<"nails" | "lashes" | null>(null);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");
  const [newServiceImageUrl, setNewServiceImageUrl] = useState("");
  const [isSavingService, setIsSavingService] = useState(false);
  // Opciones / modalidades (Clásico, Premium, etc.)
  const [newServiceOptions, setNewServiceOptions] = useState<ServiceOptionForm[]>([
    { name: "Clásico", price: "", duration_minutes: "60", description: "" },
  ]);
  // Subida de imagen de portada desde el dispositivo
  const [serviceImageFile, setServiceImageFile] = useState<File | null>(null);
  const [serviceImagePreview, setServiceImagePreview] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadServices = async () => {
    const { data: sData, error: sErr } = await supabase
      .from("services")
      .select("*, service_options(*)")
      .order("order_index", { ascending: true });

    if (sErr || !sData) {
      console.error("Error fetching services:", sErr);
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
        duration: o.duration_minutes ? `${o.duration_minutes} min` : "60 min",
        description: o.description || "",
      })),
    }));
    setServices(mapped);
  };

  useEffect(() => {
    loadServices();
  }, []);

  const tabRef = useRef<HTMLDivElement>(null);

  // ── Al abrir la vista de agregar/editar servicio, posicionarse al inicio ──
  useEffect(() => {
    if (isAddModalOpen) {
      const el = tabRef.current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [isAddModalOpen]);

  // ── Reset / apertura del formulario ────────────────────────────
  const resetServiceForm = () => {
    setEditingServiceId(null);
    setSelectedCategory(null);
    setNewServiceName("");
    setNewServiceDesc("");
    setNewServiceImageUrl("");
    setServiceImagePreview("");
    setServiceImageFile(null);
    setNewServiceOptions([{ name: "Clásico", price: "", duration_minutes: "60", description: "" }]);
  };

  const openCreateService = () => {
    resetServiceForm();
    setNewServiceOptions([{ name: "Clásico", price: "", duration_minutes: "60", description: "" }]);
    setIsAddModalOpen(true);
  };

  // ── Editar servicio (precarga el modal) ─────────────────────────
  const handleEditService = (service: Service) => {
    setEditingServiceId(service.id);
    setSelectedCategory(service.category);
    setNewServiceName(service.name);
    setNewServiceDesc(service.description || "");
    setNewServiceImageUrl(service.imageUrl || "");
    setServiceImagePreview(service.imageUrl || "");
    setServiceImageFile(null);
    setNewServiceOptions(
      (service.options && service.options.length > 0
        ? service.options
        : [{ name: "Clásico", price: "", duration_minutes: "60", description: "" }]
      ).map((o: any) => ({
        id: o.id,
        name: o.name || "",
        price: o.price != null ? String(o.price) : "",
        duration_minutes: String(o.duration || "").replace(" min", "") || "60",
        description: o.description || "",
      }))
    );
    setIsAddModalOpen(true);
  };

  // ── Gestión dinámica de opciones ────────────────────────────────
  const handleAddOption = () => {
    setNewServiceOptions((prev) => [
      ...prev,
      { name: "Nueva Modalidad", price: "", duration_minutes: "60", description: "" },
    ]);
  };

  const handleOptionChange = (index: number, field: keyof ServiceOptionForm, value: string) => {
    setNewServiceOptions((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  };

  const handleRemoveOption = (index: number) => {
    setNewServiceOptions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  // ── Subida de imagen de portada ─────────────────────────────────
  const handleServiceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setServiceImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setServiceImagePreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setServices((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex).map((s, idx) => ({ ...s, order: idx }));
        Promise.all(newArray.map((s) => supabase.from("services").update({ order_index: s.order }).eq("id", s.id))).catch((err) =>
          console.error("Error updating order", err)
        );
        return newArray;
      });
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !newServiceName.trim()) return;

    setIsSavingService(true);
    try {
      let imageUrl = newServiceImageUrl.trim();

      // Subir nueva imagen de portada si se seleccionó un archivo
      if (serviceImageFile) {
        setIsUploadingImage(true);
        const uploaded = await uploadImageToBucket(serviceImageFile, "services");
        if (uploaded) imageUrl = uploaded;
        setIsUploadingImage(false);
      }

      const servicePayload = {
        category: selectedCategory,
        name: newServiceName.trim(),
        description: newServiceDesc.trim() || "Servicio exclusivo Milibeauty",
        image_url: imageUrl || null,
        ...(editingServiceId ? {} : { order_index: services.length + 1 }),
      };

      let serviceId = editingServiceId;
      if (serviceId) {
        const { error } = await supabase.from("services").update(servicePayload).eq("id", serviceId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("services").insert(servicePayload).select().single();
        if (error) throw error;
        serviceId = data.id;
      }

      // ── Persistir opciones/modalidades (Clásico, Premium, etc.) ──
      if (serviceId) {
        const { data: existingOpts } = await supabase
          .from("service_options")
          .select("id")
          .eq("service_id", serviceId);
        const existingIds = new Set<string>((existingOpts || []).map((o: any) => o.id));
        const keptIds = new Set<string>();

        for (const opt of newServiceOptions) {
          const name = opt.name.trim();
          if (!name) continue;

          const priceNum = parseFloat(String(opt.price).replace(/[^0-9.]/g, "")) || 0;
          const durationNum = parseInt(String(opt.duration_minutes).replace(/\D/g, ""), 10) || 60;
          const optionPayload = {
            service_id: serviceId,
            name,
            price: priceNum,
            duration_minutes: durationNum,
            description: (opt.description || "").trim(),
          };

          if (opt.id && existingIds.has(opt.id)) {
            keptIds.add(opt.id);
            const { error } = await supabase.from("service_options").update(optionPayload).eq("id", opt.id);
            if (error) throw error;
          } else {
            const { data: newOpt, error } = await supabase
              .from("service_options")
              .insert(optionPayload)
              .select("id")
              .single();
            if (error) throw error;
            keptIds.add(newOpt.id);
          }
        }

        // Eliminar opciones que fueron quitadas del formulario
        for (const existingId of existingIds) {
          if (!keptIds.has(existingId)) {
            const { error } = await supabase.from("service_options").delete().eq("id", existingId);
            if (error) console.error("Error eliminando opción de servicio:", error);
          }
        }
      }

      setIsAddModalOpen(false);
      resetServiceForm();
      loadServices();
    } catch (err) {
      console.error("Error saving service:", err);
      alert("Error al guardar el servicio");
    } finally {
      setIsSavingService(false);
      setIsUploadingImage(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("¿Estás segura de eliminar este servicio?")) return;
    try {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (!error) {
        loadServices();
      } else {
        throw error;
      }
    } catch (e) {
      console.error("Error deleting service:", e);
    }
  };

  return (
    <div className="pb-32" ref={tabRef}>
      {isAddModalOpen ? (
        <div className="w-full space-y-6 animate-fade-in">
          {/* Barra superior: Volver / Cerrar */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-tertiary/70 hover:text-brand-primary bg-white px-3.5 py-2 rounded-xl border border-brand-outline/15 shadow-sm transition-all hover:bg-brand-primary/5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la lista de servicios</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="p-2 text-brand-tertiary/60 hover:text-brand-tertiary hover:bg-white rounded-xl transition-colors border border-transparent hover:border-brand-outline/15 shadow-sm"
              title="Cerrar y volver"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenedor principal blanco con diseño fluido */}
          <div className="bg-white rounded-3xl shadow-sm border border-brand-outline/15 p-5 sm:p-7 lg:p-8 space-y-6">
            <div className="border-b border-brand-outline/10 pb-5">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[11px] uppercase font-bold tracking-widest text-brand-primary bg-brand-primary/10 px-2.5 py-0.5 rounded-full border border-brand-primary/20">
                  Gestor de Servicios
                </span>
                <span className="text-xs text-brand-tertiary/30">•</span>
                <span className="text-xs font-semibold text-brand-tertiary/60">
                  {editingServiceId ? "Modo Edición" : "Nuevo Servicio"}
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl font-serif italic text-brand-tertiary">
                {editingServiceId ? "Editar Servicio" : "Agregar Nuevo Servicio"}
              </h3>
              <p className="text-xs sm:text-sm text-brand-tertiary/60 mt-1">
                {editingServiceId
                  ? "Modifica el nombre, portada, detalles y precios de las modalidades de este servicio."
                  : "Ingresa los datos del nuevo servicio para incorporarlo a tu catálogo de clientes."}
              </p>
            </div>

            {!selectedCategory ? (
              <div className="space-y-4">
                <p className="text-sm font-bold text-center text-brand-tertiary">¿Qué tipo de servicio vas a agregar?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <button type="button" onClick={() => setSelectedCategory("nails")} className="p-6 rounded-2xl border-2 border-brand-outline/15 hover:border-brand-primary bg-brand-secondary/30 hover:bg-brand-primary/5 flex flex-col items-center text-center gap-3 transition-all group">
                    <span className="text-4xl group-hover:scale-110 transition-transform">💅</span>
                    <div>
                      <h4 className="font-bold text-base text-brand-tertiary group-hover:text-brand-primary">Uñas</h4>
                      <p className="text-xs text-brand-tertiary/60 mt-1">Manicura, pedicura, acrílicas, gel, kapping.</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => setSelectedCategory("lashes")} className="p-6 rounded-2xl border-2 border-brand-outline/15 hover:border-brand-primary bg-brand-secondary/30 hover:bg-brand-primary/5 flex flex-col items-center text-center gap-3 transition-all group">
                    <span className="text-4xl group-hover:scale-110 transition-transform">👁️</span>
                    <div>
                      <h4 className="font-bold text-base text-brand-tertiary group-hover:text-brand-primary">Cejas y Pestañas</h4>
                      <p className="text-xs text-brand-tertiary/60 mt-1">Lifting, extensiones, perfilado, laminado.</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveService} className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
                  <span className="text-xs font-bold text-brand-primary flex items-center gap-2">
                    Categoría: {selectedCategory === "nails" ? "💅 Uñas" : "👁️ Cejas y Pestañas"}
                  </span>
                  <button type="button" onClick={() => setSelectedCategory(null)} className="text-[11px] font-semibold text-brand-primary underline hover:opacity-80">
                    Cambiar
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-brand-tertiary/70">Nombre del Servicio *</label>
                  <input type="text" required placeholder={selectedCategory === "nails" ? "Ej: Kapping Gel con Esmaltado" : "Ej: Laminado de Cejas"} value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} className="w-full bg-brand-secondary/30 p-2.5 rounded-xl border border-brand-outline/20 outline-none text-xs focus:border-brand-primary" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-brand-tertiary/70">Descripción del Servicio</label>
                  <textarea rows={2} placeholder="Describe los beneficios o detalles técnica..." value={newServiceDesc} onChange={(e) => setNewServiceDesc(e.target.value)} className="w-full bg-brand-secondary/30 p-2.5 rounded-xl border border-brand-outline/20 outline-none text-xs focus:border-brand-primary resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-brand-tertiary/70">Imagen de Portada del Servicio</label>
                  <div className="flex items-start gap-3">
                    <div className="w-24 h-24 rounded-xl overflow-hidden border border-brand-outline/15 bg-brand-secondary/40 shrink-0 flex items-center justify-center">
                      {serviceImagePreview ? (
                        <img src={serviceImagePreview} alt="Preview portada" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-brand-tertiary/40" />
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer border-2 border-dashed border-brand-outline/30 hover:border-brand-primary/60 bg-brand-secondary/20 hover:bg-brand-primary/5 rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all">
                      <Upload className="w-5 h-5 text-brand-primary mb-1" />
                      <span className="text-[11px] font-bold text-brand-tertiary">Subir imagen desde el dispositivo</span>
                      <span className="text-[10px] text-brand-tertiary/50">JPG, PNG, WEBP · máx 5 MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleServiceImageChange}
                      />
                    </label>
                  </div>
                  {isUploadingImage && (
                    <p className="flex items-center gap-2 text-[11px] text-brand-primary mt-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo imagen...
                    </p>
                  )}
                </div>

                {/* ── Opciones / Modalidades (Clásico, Premium, etc.) ── */}
                <div className="bg-brand-secondary/20 border border-brand-outline/10 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-tertiary/70">Opciones / Modalidades</span>
                    <button type="button" onClick={handleAddOption} className="flex items-center gap-1 text-[11px] font-bold text-brand-primary hover:opacity-80">
                      <Plus className="w-3.5 h-3.5" /> Agregar opción
                    </button>
                  </div>

                  {newServiceOptions.map((opt, idx) => (
                    <div key={opt.id || idx} className="bg-white rounded-xl border border-brand-outline/15 p-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Nombre / Tipo (ej. Clásico, Premium)"
                          value={opt.name}
                          onChange={(e) => handleOptionChange(idx, "name", e.target.value)}
                          className="flex-1 min-w-0 bg-brand-secondary/30 p-2 rounded-lg border border-brand-outline/20 outline-none text-xs focus:border-brand-primary"
                        />
                        {newServiceOptions.length > 1 && (
                          <button type="button" onClick={() => handleRemoveOption(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0" title="Eliminar opción">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-brand-tertiary/50 mb-1">Precio ($)</label>
                          <input type="text" inputMode="decimal" placeholder="Ej: 25" value={opt.price} onChange={(e) => handleOptionChange(idx, "price", e.target.value)} className="w-full bg-brand-secondary/30 p-2 rounded-lg border border-brand-outline/20 outline-none text-xs focus:border-brand-primary" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-brand-tertiary/50 mb-1">Duración (min)</label>
                          <input type="text" inputMode="numeric" placeholder="Ej: 60" value={opt.duration_minutes} onChange={(e) => handleOptionChange(idx, "duration_minutes", e.target.value)} className="w-full bg-brand-secondary/30 p-2 rounded-lg border border-brand-outline/20 outline-none text-xs focus:border-brand-primary" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-brand-tertiary/50 mb-1">Descripción (qué incluye)</label>
                        <textarea rows={2} placeholder="Ej: Esmaltado semipermanente + limado + hidratación" value={opt.description} onChange={(e) => handleOptionChange(idx, "description", e.target.value)} className="w-full bg-brand-secondary/30 p-2 rounded-lg border border-brand-outline/20 outline-none text-xs focus:border-brand-primary resize-none" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-brand-outline/10">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-brand-outline/20 text-xs font-bold uppercase text-brand-tertiary/70 hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSavingService} className="bg-brand-primary text-white px-5 py-2.5 rounded-xl text-xs uppercase font-bold tracking-wider flex items-center gap-2 shadow-xs hover:opacity-95">
                    {isSavingService ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {editingServiceId ? "Guardar Cambios" : "Guardar Servicio"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : (
        <>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-serif italic mb-2">Gestor de Servicios</h2>
            <p className="text-brand-tertiary/60">Agrega, edita y arrastra para reordenar tus servicios.</p>
          </div>
          <button
            onClick={openCreateService}
            className="bg-brand-primary text-white px-5 py-3 flex items-center gap-2 rounded-xl text-xs uppercase font-bold tracking-widest shadow-sm hover:opacity-95 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Agregar Servicio
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={services} strategy={verticalListSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <SortableServiceItem key={service.id} service={service} onEdit={handleEditService} onDelete={handleDeleteService} />
              ))}
            </div>
          </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}

function SortableServiceItem({ service, onEdit, onDelete }: { service: Service; onEdit?: (s: Service) => void; onDelete?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: service.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const categoryLabel = service.category === "nails" ? "💅 Uñas" : "👁️ Cejas y Pestañas";

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-2xl shadow-sm border border-brand-outline/15 overflow-hidden transition-all hover:shadow-md flex flex-col justify-between">
      <div className="bg-brand-secondary/40 px-4 py-2.5 border-b border-brand-outline/10 flex items-center justify-between">
        <div {...attributes} {...listeners} className="flex items-center gap-2 px-2.5 py-1 bg-white hover:bg-brand-primary/10 rounded-lg text-brand-tertiary/70 hover:text-brand-primary cursor-grab active:cursor-grabbing touch-none transition-colors border border-brand-outline/15 shadow-2xs" title="Arrastrar para reordenar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
          <span className="text-[10px] font-bold tracking-wider uppercase">Reordenar</span>
        </div>
        <span className="text-[11px] bg-brand-primary/10 text-brand-primary font-bold px-3 py-1 rounded-full border border-brand-primary/20">{categoryLabel}</span>
      </div>
      <div className="p-4 space-y-4 flex-1">
        <div className="flex gap-3.5 items-start">
          <Image src={service.imageUrl} alt={service.name} width={96} height={96} quality={90} className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 border border-brand-outline/10 shadow-xs" />
          <div className="min-w-0 flex-1">
            <h4 className="font-serif font-bold text-base text-brand-tertiary leading-tight mb-1">{service.name}</h4>
            <p className="text-xs text-brand-tertiary/70 line-clamp-2 leading-relaxed">{service.description}</p>
          </div>
        </div>
        <div className="bg-brand-secondary/30 rounded-xl p-3 border border-brand-outline/10 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-tertiary/50 block">Modalidades y Precios</span>
          <div className="flex flex-wrap gap-2">
            {service.options?.map((opt) => (
              <div key={opt.id} className="bg-white px-3 py-1.5 rounded-lg border border-brand-outline/15 flex items-center justify-between gap-3 text-xs shadow-2xs flex-1 min-w-[130px]">
                <span className="font-medium text-brand-tertiary">{opt.name}</span>
                <span className="font-bold text-brand-primary text-sm">€${opt.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 pt-0 grid grid-cols-2 gap-2.5">
        {onEdit && (
          <button onClick={() => onEdit(service)} className="w-full py-3 px-4 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-brand-primary/20">
            <Pencil className="w-4 h-4" /> Editar
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(service.id)} className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-red-200">
            <Trash2 className="w-4 h-4" /> Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

// Schedule Tab
function ScheduleTab() {
  const [schedule, setSchedule] = useState<any>({
    weeklySchedule: {
      0: { active: false, slots: [] },
      1: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      2: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      3: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      4: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      5: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] },
      6: { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00"] },
    },
    blockedDates: [],
    blockedNotes: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(1);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState("");
  const [blockDateInput, setBlockDateInput] = useState("");
  const [blockNoteInput, setBlockNoteInput] = useState("");

  const dayNames = [
    { idx: 1, name: "Lunes", short: "Lun" },
    { idx: 2, name: "Martes", short: "Mar" },
    { idx: 3, name: "Miércoles", short: "Mié" },
    { idx: 4, name: "Jueves", short: "Jue" },
    { idx: 5, name: "Viernes", short: "Vie" },
    { idx: 6, name: "Sábado", short: "Sáb" },
    { idx: 0, name: "Domingo", short: "Dom" },
  ];

  const standardHours = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  ];

  const fetchScheduleData = async () => {
    try {
      const { data: schedData, error: schedErr } = await supabase.from("schedules").select("*");
      if (schedErr) throw schedErr;
      const { data: blockData, error: blockErr } = await supabase.from("blocked_dates").select("*");
      if (blockErr) throw blockErr;

      const newWeekly: any = {};
      for (let i = 0; i < 7; i++) {
        newWeekly[i] = { active: false, slots: [] };
      }
      if (schedData && schedData.length > 0) {
        schedData.forEach((s: any) => {
          newWeekly[s.day_of_week] = { active: s.is_active, slots: s.slots || [] };
        });
      } else {
        [1, 2, 3, 4, 5, 6].forEach((d) => {
          newWeekly[d] = { active: true, slots: ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"] };
        });
      }

      const newBlockedDates = (blockData || []).map((b: any) => b.date);
      const newBlockedNotes: any = {};
      (blockData || []).forEach((b: any) => {
        newBlockedNotes[b.date] = b.reason;
      });

      setSchedule({ weeklySchedule: newWeekly, blockedDates: newBlockedDates, blockedNotes: newBlockedNotes });
    } catch (e) {
      console.error("Error fetching schedules:", e);
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
      const upsertPayload = Object.keys(schedule.weeklySchedule).map((dayIdxStr) => {
        const dayIdx = parseInt(dayIdxStr);
        return {
          day_of_week: dayIdx,
          is_active: schedule.weeklySchedule[dayIdx].active,
          slots: schedule.weeklySchedule[dayIdx].slots,
        };
      });
      const { error } = await supabase.from("schedules").upsert(upsertPayload, { onConflict: "day_of_week" });
      if (error) throw error;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (e) {
      console.error("Error saving schedule:", e);
      alert("Error al guardar los horarios");
    } finally {
      setSaving(false);
    }
  };

  const toggleDayActive = (dayIdx: number) => {
    setSchedule((prev: any) => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [dayIdx]: { ...prev.weeklySchedule[dayIdx], active: !prev.weeklySchedule[dayIdx]?.active },
      },
    }));
  };

  const toggleSlot = (dayIdx: number, slot: string) => {
    setSchedule((prev: any) => {
      const currentSlots: string[] = prev.weeklySchedule[dayIdx]?.slots || [];
      const exists = currentSlots.includes(slot);
      const updated = exists ? currentSlots.filter((s) => s !== slot).sort() : [...currentSlots, slot].sort();
      return {
        ...prev,
        weeklySchedule: { ...prev.weeklySchedule, [dayIdx]: { ...prev.weeklySchedule[dayIdx], slots: updated } },
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
          weeklySchedule: { ...prev.weeklySchedule, [dayIdx]: { ...prev.weeklySchedule[dayIdx], slots: updated } },
        };
      }
      return prev;
    });
    setCustomTimeInput("");
  };

  const handleAddBlockedDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDateInput) return;
    const { error } = await supabase.from("blocked_dates").insert({
      date: blockDateInput,
      reason: blockNoteInput.trim() || "Bloqueado por administración",
    });
    if (error) {
      if (error.code === "23505") {
        alert("Esa fecha ya está bloqueada.");
      } else {
        alert("Error al bloquear la fecha: " + error.message);
      }
      return;
    }
    setSchedule((prev: any) => {
      const dates: string[] = prev.blockedDates || [];
      if (!dates.includes(blockDateInput)) {
        return {
          ...prev,
          blockedDates: [...dates, blockDateInput].sort(),
          blockedNotes: { ...prev.blockedNotes, [blockDateInput]: blockNoteInput.trim() || "Bloqueado por administración" },
        };
      }
      return prev;
    });
    setBlockDateInput("");
    setBlockNoteInput("");
  };

  const handleRemoveBlockedDate = async (dateStr: string) => {
    const { error } = await supabase.from("blocked_dates").delete().eq("date", dateStr);
    if (error) {
      alert("Error al eliminar bloqueo: " + error.message);
      return;
    }
    setSchedule((prev: any) => {
      const updatedDates = (prev.blockedDates || []).filter((d: string) => d !== dateStr);
      const updatedNotes = { ...prev.blockedNotes };
      delete updatedNotes[dateStr];
      return { ...prev, blockedDates: updatedDates, blockedNotes: updatedNotes };
    });
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
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="bg-brand-primary text-white px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-all shrink-0 active:scale-95">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ¡Configuración de horarios y días bloqueados guardada con éxito!
        </div>
      )}

      <section className="bg-white p-6 rounded-2xl border border-brand-outline/10 shadow-xs space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-brand-outline/10">
          <Clock className="w-5 h-5 text-brand-primary" />
          <h3 className="font-serif italic text-xl">Horario Semanal Habitual</h3>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {dayNames.map(({ idx, short }) => {
            const dayData = schedule.weeklySchedule?.[idx];
            const isActive = dayData?.active;
            const slotCount = dayData?.slots?.length || 0;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => { setSelectedDayIdx(idx); setIsDayModalOpen(true); }}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between border-brand-outline/10 bg-brand-secondary/50 hover:bg-brand-secondary active:scale-95`}
              >
                <span className="text-xs font-bold">{short}</span>
                <span className={`text-[10px] mt-1.5 px-2 py-0.5 rounded-full font-semibold ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"}`}>
                  {isActive ? `${slotCount} turnos` : "Cerrado"}
                </span>
              </button>
            );
          })}
        </div>

        {isDayModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-brand-outline/10 p-4">
                <h4 className="font-bold flex items-center gap-2">
                  <span className="text-brand-primary font-serif italic text-xl">{dayNames.find((d) => d.idx === selectedDayIdx)?.name}</span>
                </h4>
                <button type="button" onClick={() => setIsDayModalOpen(false)} className="p-2 -mr-2 text-brand-tertiary/60 hover:text-brand-tertiary hover:bg-brand-secondary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between border-b border-brand-outline/10 pb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-tertiary/70">Estado del Día</span>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-tertiary/70">{currentDayInfo.active ? "Laboral" : "Libre"}</span>
                    <input type="checkbox" checked={currentDayInfo.active} onChange={() => toggleDayActive(selectedDayIdx)} className="sr-only" />
                    <div className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${currentDayInfo.active ? "bg-brand-primary" : "bg-gray-300"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${currentDayInfo.active ? "translate-x-5" : "translate-x-0"}`} />
                    </div>
                  </label>
                </div>
                {currentDayInfo.active ? (
                  <div className="space-y-4">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-brand-tertiary/70 mb-2">Horarios de Atención</h5>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {Array.from(new Set([...standardHours, ...(currentDayInfo.slots || [])])).sort().map((hour) => {
                        const isSelected = currentDayInfo.slots?.includes(hour);
                        return (
                          <button
                            key={hour}
                            type="button"
                            onClick={() => toggleSlot(selectedDayIdx, hour)}
                            className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all border text-center ${
                              isSelected
                                ? "bg-brand-tertiary text-white border-brand-tertiary shadow-2xs hover:bg-red-900/90"
                                : "bg-white border-brand-outline/10 text-brand-tertiary/60 hover:border-brand-primary/40 hover:text-brand-primary"
                            }`}
                            title={isSelected ? `Eliminar ${hour}` : `Activar ${hour}`}
                          >
                            {formatTime12h(hour)}
                          </button>
                        );
                      })}
                    </div>
                    <div className="pt-2 flex items-center gap-2">
                      <input type="text" placeholder="Otra hora (ej: 07:30)" value={customTimeInput} onChange={(e) => setCustomTimeInput(e.target.value)} className="bg-white px-3 py-1.5 rounded-lg border border-brand-outline/20 text-[11px] outline-none focus:border-brand-primary w-36" />
                      <button type="button" onClick={() => addCustomSlot(selectedDayIdx)} className="bg-brand-primary text-white text-[11px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:opacity-90 transition-opacity">
                        <Plus className="w-3 h-3" /> Añadir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-brand-tertiary/40 py-8 italic">Día marcado como no laboral. Actívalo para habilitar turnos.</div>
                )}
              </div>
              <div className="p-4 bg-brand-secondary/30 border-t border-brand-outline/10 flex justify-end">
                <button type="button" onClick={() => setIsDayModalOpen(false)} className="bg-brand-tertiary text-white px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:opacity-90">
                  Hecho
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white p-6 rounded-2xl border border-brand-outline/10 shadow-xs space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-brand-outline/10">
          <CalendarX className="w-5 h-5 text-red-500" />
          <h3 className="font-serif italic text-xl">Bloqueo de Días Especiales</h3>
        </div>
        <form onSubmit={handleAddBlockedDate} className="bg-brand-secondary/40 p-4 rounded-xl border border-brand-outline/10 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-tertiary/70">Fecha a Bloquear *</label>
              <input type="date" required value={blockDateInput} min={new Date().toISOString().split("T")[0]} onChange={(e) => setBlockDateInput(e.target.value)} className="w-full bg-white p-2.5 rounded-lg border border-brand-outline/20 outline-none text-xs focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-tertiary/70">Motivo u Observación (Opcional)</label>
              <input type="text" placeholder="Ej. Feriado Nacional, Día de Entrenamiento" value={blockNoteInput} onChange={(e) => setBlockNoteInput(e.target.value)} className="w-full bg-white p-2.5 rounded-lg border border-brand-outline/20 outline-none text-xs focus:border-brand-primary" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors">
              <CalendarX className="w-3.5 h-3.5" /> Bloquear Fecha
            </button>
          </div>
        </form>
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-tertiary/70">Días Bloqueados Actualmente ({schedule.blockedDates?.length || 0}):</h4>
          {(!schedule.blockedDates || schedule.blockedDates.length === 0) ? (
            <div className="p-6 bg-brand-secondary/20 rounded-xl text-center text-xs text-brand-tertiary/50 border border-dashed border-brand-outline/20">
              No hay días bloqueados guardados. Utiliza el formulario arriba para agregar excepciones.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {schedule.blockedDates.map((dateStr: string) => {
                const note = schedule.blockedNotes?.[dateStr] || "Bloqueado";
                const parts = dateStr.split("-");
                const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                return (
                  <div key={dateStr} className="flex items-center justify-between p-3 bg-red-50/60 border border-red-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 text-red-600 rounded-lg"><CalendarX className="w-4 h-4" /></div>
                      <div>
                        <span className="font-bold text-xs text-red-900 block">{formattedDate}</span>
                        <span className="text-[11px] text-red-700/80">{note}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => handleRemoveBlockedDate(dateStr)} className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors" title="Desbloquear fecha">
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

// Client Interface Tab
function ClientInterfaceTab() {
  const [categoryImages, setCategoryImages] = useState({
    nails: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop",
    lashes: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1000&auto=format&fit=crop",
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
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Milibeauty+Studio",
    bankName: "Banesco (0134)",
    bankId: "V-26123456",
    bankPhone: "0412-1234567",
    bankOwner: "Milibeauty C.A.",
    premiumEnabled: true,
    whatsappReminderTemplate:
      "¡Hola {nombre}! ✨ Se acerca el tiempo ideal para el retoque de tu servicio de {servicio}. Tu cita fue el {fecha} a las {hora}. ¿Te gustaría agendar tu cita para esta semana?",
    whatsappConfirmationTemplate:
      "¡Hola {nombre}! 🌸 Tu cita en Milibeauty quedó confirmada: {servicio} el {fecha} a las {hora}. ¡Te esperamos! 💅✨",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Subida de portadas de especialidades desde el dispositivo
  const [categoryUploading, setCategoryUploading] = useState<"nails" | "lashes" | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        console.log("🔄 [Admin] Cargando configuración desde Supabase & API...");

        // 1. Cargar imágenes de portada
        fetch("/api/categories/images")
          .then((res) => res.json())
          .then((data) => {
            if (data?.nails || data?.lashes) {
              setCategoryImages((prev) => ({ nails: data.nails || prev.nails, lashes: data.lashes || prev.lashes }));
            }
          })
          .catch(console.error);

        // 2. Consulta directa a Supabase (app_settings)
        const { data: dbSettings, error: dbErr } = await supabase
          .from("app_settings")
          .select("key, value");

        let premiumFromDB: boolean | null = null;
        let siteConfigFromDB: any = null;

        if (!dbErr && dbSettings && dbSettings.length > 0) {
          console.log("✅ [Admin] Datos recibidos directamente de Supabase (app_settings):", dbSettings);
          dbSettings.forEach((item) => {
            if (item.key === "premium_enabled") {
              premiumFromDB = typeof item.value === "string" ? item.value === "true" : Boolean(item.value);
            }
            if (item.key === "site_config" && typeof item.value === "object" && item.value !== null) {
              siteConfigFromDB = item.value;
            }
          });
        } else if (dbErr) {
          console.warn("Aviso leyendo app_settings de Supabase:", dbErr);
        }

        // 3. Consulta a API de respaldo
        const res = await fetch("/api/site-config");
        const apiData = await res.json();
        console.log("✅ [Admin] Configuración API site-config:", apiData);

        setSiteConfig((prev) => {
          const merged = {
            ...prev,
            ...(apiData || {}),
            ...(siteConfigFromDB || {}),
          };
          if (premiumFromDB !== null) {
            merged.premiumEnabled = premiumFromDB;
          } else if (apiData?.premiumEnabled !== undefined) {
            merged.premiumEnabled = Boolean(apiData.premiumEnabled);
          }
          console.log("✨ [Admin] Estado de Modo Premium inicializado desde DB:", merged.premiumEnabled);
          return merged;
        });
      } catch (err) {
        console.error("❌ [Admin] Error al cargar la configuración:", err);
      }
    };

    loadConfig();
  }, []);

  const [isPremiumSaving, setIsPremiumSaving] = useState(false);

  const handleTogglePremium = async (newVal: boolean) => {
    // 1. Actualización optimista inmediata
    const previousVal = siteConfig.premiumEnabled;
    setSiteConfig((prev) => ({ ...prev, premiumEnabled: newVal }));
    setIsPremiumSaving(true);

    try {
      // 2. Persistir en Supabase con la única clave canonica: 'premium_enabled'
      //    El valor es un bool nativo — Supabase lo convierte a JSONB automáticamente
      const { error: dbError } = await supabase.from("app_settings").upsert(
        { key: "premium_enabled", value: newVal },
        { onConflict: "key" }
      );

      if (dbError) {
        // Rollback: revertir estado local si falla la escritura
        console.error("[Admin] Error persistiendo premium_enabled:", dbError);
        setSiteConfig((prev) => ({ ...prev, premiumEnabled: previousVal }));
        return;
      }

      // 3. Sincronizar la API en memoria (/api/site-config) para consistencia
      await fetch("/api/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premiumEnabled: newVal }),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error("[Admin] Error inesperado al cambiar premium:", err);
      // Rollback también ante errores de red
      setSiteConfig((prev) => ({ ...prev, premiumEnabled: previousVal }));
    } finally {
      setIsPremiumSaving(false);
    }
  };

  // Sube una portada de especialidad al Storage, muestra preview y actualiza categoryImages
  const handleCategoryImageChange = async (key: "nails" | "lashes", file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCategoryImages((prev) => ({ ...prev, [key]: String(reader.result) }));
    reader.readAsDataURL(file);

    setCategoryUploading(key);
    try {
      const url = await uploadImageToBucket(file, "covers");
      if (url) {
        setCategoryImages((prev) => ({ ...prev, [key]: url }));
        console.log(`✅ [Admin] Portada "${key}" actualizada:`, url);
      } else {
        alert("Error al subir la imagen de portada. Verifica que el bucket de Storage esté configurado.");
      }
    } catch (err) {
      console.error("❌ [Admin] Error subiendo portada:", err);
      alert("Error al subir la imagen de portada.");
    } finally {
      setCategoryUploading(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const [resImg, resConfig] = await Promise.all([
        fetch("/api/categories/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(categoryImages) }),
        fetch("/api/site-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(siteConfig) }),
      ]);
      if (resImg.ok && resConfig.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch (e) {
      console.error(e);
      alert("Error guardando los cambios de la interfaz");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={isSaving} className="bg-brand-primary text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-brand-primary-light transition-colors shrink-0 shadow-sm active:scale-95">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Guardar Cambios</span>
        </button>
      </div>
      {saveSuccess && (
        <div className="bg-emerald-50 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2 border border-emerald-200 shadow-xs animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span><strong>¡Configuración guardada!</strong> Los cambios ya se reflejan en tiempo real en la experiencia de tus clientes.</span>
        </div>
      )}

      {/* ── MODALIDAD PREMIUM ── */}
      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
              siteConfig.premiumEnabled ? "bg-amber-100" : "bg-gray-100"
            }`}>
              <Sparkles className={`w-5 h-5 transition-colors duration-300 ${
                siteConfig.premiumEnabled ? "text-amber-500" : "text-gray-400"
              }`} />
            </div>
            <div className="min-w-0">
              <h4 className="font-serif italic font-medium text-base text-brand-tertiary leading-tight">
                Modalidad Premium
              </h4>
              <p className="text-xs text-brand-tertiary/55 mt-0.5 leading-snug">
                {siteConfig.premiumEnabled
                  ? "Las opciones Premium son visibles para los clientes."
                  : "Solo modalidades clásicas son visibles para los clientes."}
              </p>
            </div>
          </div>

          {/* Toggle iOS-style */}
          <button
            role="switch"
            aria-checked={Boolean(siteConfig.premiumEnabled)}
            aria-label="Activar o desactivar modo Premium"
            disabled={isPremiumSaving}
            onClick={() => handleTogglePremium(!siteConfig.premiumEnabled)}
            className={`relative flex-shrink-0 w-[52px] h-[30px] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary transition-colors duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed ${
              siteConfig.premiumEnabled
                ? "bg-brand-primary"
                : "bg-gray-200"
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <span
              className={`absolute top-[3px] left-[3px] w-6 h-6 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)] flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                siteConfig.premiumEnabled ? "translate-x-[22px]" : "translate-x-0"
              }`}
            >
              {isPremiumSaving ? (
                <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                  siteConfig.premiumEnabled ? "bg-brand-primary" : "bg-gray-300"
                }`} />
              )}
            </span>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-brand-outline/10 flex items-center justify-between">
          <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full transition-all duration-300 ${
            siteConfig.premiumEnabled
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-gray-50 text-gray-500 border border-gray-200"
          }`}>
            {siteConfig.premiumEnabled ? "✨ Premium Activo" : "Estándar"}
          </span>
          <p className="text-[11px] text-brand-tertiary/50 leading-snug max-w-[200px] text-right">
            El cambio se propaga instantáneamente a todos los clientes.
          </p>
        </div>
      </div>

      {/* ── GESTIÓN DE DATOS DE PAGO MÓVIL Y TRANSFERENCIAS ── */}
      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-brand-outline/10 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-brand-primary" />
            <div>
              <h4 className="font-serif italic font-medium text-lg text-brand-tertiary">Datos de Pago Móvil & Bancarios</h4>
              <p className="text-xs text-brand-tertiary/60">Se sincronizan en el paso de confirmación y pago de tus clientas.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
              Banco (con código) *
            </label>
            <input
              type="text"
              placeholder="Ej: Banesco (0134) o Mercantil (0105)"
              value={siteConfig.bankName || ""}
              onChange={(e) => setSiteConfig((prev) => ({ ...prev, bankName: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
              Cédula de Identidad o RIF *
            </label>
            <input
              type="text"
              placeholder="Ej: V-26123456 o J-123456789"
              value={siteConfig.bankId || ""}
              onChange={(e) => setSiteConfig((prev) => ({ ...prev, bankId: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
              Teléfono para Pago Móvil *
            </label>
            <input
              type="text"
              placeholder="Ej: 0412-1234567"
              value={siteConfig.bankPhone || ""}
              onChange={(e) => setSiteConfig((prev) => ({ ...prev, bankPhone: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
              Titular de la Cuenta *
            </label>
            <input
              type="text"
              placeholder="Ej: Milibeauty Studio C.A."
              value={siteConfig.bankOwner || ""}
              onChange={(e) => setSiteConfig((prev) => ({ ...prev, bankOwner: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white"
              required
            />
          </div>
        </div>

        {/* Vista previa en tiempo real */}
        <div className="mt-2 p-3.5 bg-brand-secondary/30 rounded-2xl border border-brand-outline/15 space-y-2">
          <span className="text-[10px] font-bold uppercase text-brand-primary tracking-widest block">
            Vista Previa de lo que verá la Clienta:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 bg-white rounded-xl border border-brand-outline/10">
              <span className="text-[9px] text-brand-tertiary/50 uppercase font-bold block">Banco</span>
              <span className="font-bold text-brand-tertiary">{siteConfig.bankName || "Por definir"}</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-brand-outline/10">
              <span className="text-[9px] text-brand-tertiary/50 uppercase font-bold block">CI / RIF</span>
              <span className="font-bold text-brand-tertiary">{siteConfig.bankId || "Por definir"}</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-brand-outline/10">
              <span className="text-[9px] text-brand-tertiary/50 uppercase font-bold block">Teléfono</span>
              <span className="font-bold text-brand-tertiary">{siteConfig.bankPhone || "Por definir"}</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-brand-outline/10">
              <span className="text-[9px] text-brand-tertiary/50 uppercase font-bold block">Titular</span>
              <span className="font-bold text-brand-tertiary">{siteConfig.bankOwner || "Por definir"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs space-y-4">
        <h4 className="font-serif italic font-medium text-lg text-brand-tertiary border-b border-brand-outline/10 pb-3 flex items-center gap-2">
          <Pencil className="w-4 h-4 text-brand-primary" /> Identidad y Bienvenida de la App
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">Nombre del Estudio / App</label>
            <input type="text" value={siteConfig.studioName} onChange={(e) => setSiteConfig((prev) => ({ ...prev, studioName: e.target.value }))} className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">Subtítulo / Mensaje de Bienvenida</label>
            <input type="text" value={siteConfig.studioSubtitle} onChange={(e) => setSiteConfig((prev) => ({ ...prev, studioSubtitle: e.target.value }))} className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs space-y-4">
        <h4 className="font-serif italic font-medium text-lg text-brand-tertiary border-b border-brand-outline/10 pb-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-brand-primary" /> Ubicación del Studio & Mapa
        </h4>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">Dirección Física Completa</label>
            <input type="text" value={siteConfig.studioAddress || ""} onChange={(e) => setSiteConfig((prev) => ({ ...prev, studioAddress: e.target.value }))} className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">Enlace de Google Maps</label>
            <input type="text" value={siteConfig.mapsUrl || ""} onChange={(e) => setSiteConfig((prev) => ({ ...prev, mapsUrl: e.target.value }))} className="w-full px-3.5 py-2.5 text-xs bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white font-mono" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs space-y-5">
        <h4 className="font-serif italic font-medium text-lg text-brand-tertiary border-b border-brand-outline/10 pb-3 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-brand-primary" /> Tarjetas de Portada (Pantalla Principal)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 bg-brand-secondary/30 p-5 rounded-2xl border border-brand-outline/10">
            <h5 className="font-serif italic font-medium text-base text-brand-tertiary">💅 Categoría Manicure</h5>
            <div className="relative h-40 rounded-xl overflow-hidden shadow-sm border border-brand-outline/10">
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />
              <Image src={categoryImages.nails} alt="Preview Manicure" fill sizes="(max-width: 768px) 100vw, 50vw" quality={90} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 p-4 z-20 w-full">
                <span className="text-brand-primary-light text-[10px] font-semibold uppercase tracking-widest block">{siteConfig.nailsTag || "Especialidad"}</span>
                <h6 className="text-white text-xl font-serif italic font-medium">{siteConfig.nailsTitle || "Manicure"}</h6>
              </div>
            </div>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-brand-outline/30 hover:border-brand-primary/60 bg-white hover:bg-brand-primary/5 cursor-pointer rounded-lg py-2.5 text-xs font-bold text-brand-tertiary/70 hover:text-brand-primary transition-all">
              {categoryUploading === "nails" ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
              ) : (
                <Upload className="w-4 h-4 text-brand-primary" />
              )}
              <span>{categoryUploading === "nails" ? "Subiendo..." : "Subir imagen desde el dispositivo"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCategoryImageChange("nails", f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="space-y-4 bg-brand-secondary/30 p-5 rounded-2xl border border-brand-outline/10">
            <h5 className="font-serif italic font-medium text-base text-brand-tertiary">👁️ Categoría Cejas & Pestañas</h5>
            <div className="relative h-40 rounded-xl overflow-hidden shadow-sm border border-brand-outline/10">
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />
              <Image src={categoryImages.lashes} alt="Preview Cejas y Pestañas" fill sizes="(max-width: 768px) 100vw, 50vw" quality={90} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 p-4 z-20 w-full">
                <span className="text-brand-primary-light text-[10px] font-semibold uppercase tracking-widest block">{siteConfig.lashesTag || "Especialidad"}</span>
                <h6 className="text-white text-xl font-serif italic font-medium">{siteConfig.lashesTitle || "Cejas y Pestañas"}</h6>
              </div>
            </div>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-brand-outline/30 hover:border-brand-primary/60 bg-white hover:bg-brand-primary/5 cursor-pointer rounded-lg py-2.5 text-xs font-bold text-brand-tertiary/70 hover:text-brand-primary transition-all">
              {categoryUploading === "lashes" ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
              ) : (
                <Upload className="w-4 h-4 text-brand-primary" />
              )}
              <span>{categoryUploading === "lashes" ? "Subiendo..." : "Subir imagen desde el dispositivo"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCategoryImageChange("lashes", f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs space-y-4">
        <h4 className="font-serif italic font-medium text-lg text-brand-tertiary border-b border-brand-outline/10 pb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-brand-primary" /> Plantilla de Recordatorio por WhatsApp
        </h4>
        <p className="text-xs text-brand-tertiary/60 leading-relaxed">
          Este mensaje se envía automáticamente a las clientas cuando llega el tiempo de retoque de su servicio.
          Puedes usar estas variables, que se reemplazarán automáticamente con los datos de cada reserva:
        </p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {["{nombre}", "{servicio}", "{fecha}", "{hora}"].map((v) => (
            <code key={v} className="px-2 py-1 bg-brand-secondary/50 border border-brand-outline/10 rounded-lg font-mono text-brand-primary">{v}</code>
          ))}
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
            Mensaje del recordatorio
          </label>
          <textarea
            value={siteConfig.whatsappReminderTemplate || ""}
            onChange={(e) => setSiteConfig((prev) => ({ ...prev, whatsappReminderTemplate: e.target.value }))}
            rows={5}
            placeholder="¡Hola {nombre}! Se acerca el tiempo ideal para el retoque de tu servicio de {servicio}..."
            className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white resize-y leading-relaxed"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-brand-tertiary/50">
          <CheckCircle className="w-3.5 h-3.5 text-brand-primary shrink-0" />
          <span>
            Se guarda al pulsar <strong>Guardar Cambios</strong>. Si dejas alguna variable fuera, se omitirá en el mensaje.
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-brand-outline/10 shadow-xs space-y-4">
        <h4 className="font-serif italic font-medium text-lg text-brand-tertiary border-b border-brand-outline/10 pb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-brand-primary" /> Plantilla de Confirmación de Reserva por WhatsApp
        </h4>
        <p className="text-xs text-brand-tertiary/60 leading-relaxed">
          Este mensaje se envía automáticamente a la clienta justo después de que confirme su reserva desde el sitio web.
          Puedes usar estas variables, que se reemplazarán automáticamente con los datos de cada reserva:
        </p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {["{nombre}", "{servicio}", "{fecha}", "{hora}"].map((v) => (
            <code key={v} className="px-2 py-1 bg-brand-secondary/50 border border-brand-outline/10 rounded-lg font-mono text-brand-primary">{v}</code>
          ))}
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase text-brand-tertiary/70 tracking-wider block mb-1">
            Mensaje de confirmación
          </label>
          <textarea
            value={siteConfig.whatsappConfirmationTemplate || ""}
            onChange={(e) => setSiteConfig((prev) => ({ ...prev, whatsappConfirmationTemplate: e.target.value }))}
            rows={5}
            placeholder="¡Hola {nombre}! Tu cita en Milibeauty quedó confirmada: {servicio} el {fecha} a las {hora}. ¡Te esperamos!"
            className="w-full px-3.5 py-2.5 text-sm bg-brand-secondary/30 border border-brand-outline/10 rounded-xl outline-none focus:border-brand-primary focus:bg-white resize-y leading-relaxed"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-brand-tertiary/50">
          <CheckCircle className="w-3.5 h-3.5 text-brand-primary shrink-0" />
          <span>
            Se guarda al pulsar <strong>Guardar Cambios</strong>. Si dejas alguna variable fuera, se omitirá en el mensaje.
          </span>
        </div>
      </div>
    </div>
  );
}