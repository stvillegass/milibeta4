"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  Heart,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import ReservationModal from "@/components/ReservationModal";
import { supabase } from "@/lib/supabase";

interface LookbookItem {
  id: string;
  category: "nails" | "lashes" | "studio" | "transformation";
  title: string;
  subtitle: string;
  imageUrl: string;
  tag: string;
  duration?: string;
  details?: string;
  serviceId?: string | null;
  likes?: number;
  likes_count?: number;
}

export default function BookingPage() {
  const [items, setItems] = useState<LookbookItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "nails" | "lashes" | "studio">("all");
  const [selectedItem, setSelectedItem] = useState<LookbookItem | null>(null);
  const [likedItems, setLikedItems] = useState<Record<string, boolean>>({});
  const [likesCount, setLikesCount] = useState<Record<string, number>>({});
  const [bookingServiceId, setBookingServiceId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addCategory, setAddCategory] = useState<"nails" | "lashes" | "studio" | "transformation">("nails");
  const [addImageUrl, setAddImageUrl] = useState("");
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(!!session);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from("lookbook_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching lookbook:", error);
        setItemsError("No se pudieron cargar los elementos del lookbook.");
        return;
      }

      const mapped: LookbookItem[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        subtitle: row.title,
        imageUrl: row.image_url,
        tag: row.category === "nails" ? "Manicure" : row.category === "lashes" ? "Cejas y Pestañas" : "El Studio",
        likes_count: row.likes_count || 0,
      }));

      setItems(mapped);

      const initialLikes: Record<string, number> = {};
      mapped.forEach((item) => {
        initialLikes[item.id] = item.likes_count || 0;
      });
      setLikesCount(initialLikes);
      setItemsError(null);
    } catch (err) {
      console.error("Error loading lookbook:", err);
      setItemsError("No se pudieron cargar los elementos del lookbook.");
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const resolveServiceIdForBooking = async (item: LookbookItem): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id, category, name")
        .order("order_index", { ascending: true });

      if (error || !data || data.length === 0) return null;

      if (item.serviceId && data.some((s) => s.id === item.serviceId)) {
        return item.serviceId;
      }

      if (item.category === "nails" || item.category === "lashes") {
        const match = data.find((s) => s.category === item.category);
        if (match) return match.id;
      }

      return data[0].id;
    } catch (err) {
      console.error("Error resolving service for booking:", err);
      return null;
    }
  };

  const handleToggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedItems((prev) => {
      const isLiked = !prev[id];
      setLikesCount((lc) => ({
        ...lc,
        [id]: (lc[id] || 35) + (isLiked ? 1 : -1),
      }));
      return { ...prev, [id]: isLiked };
    });
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("¿Eliminar este elemento del lookbook?")) return;
    setIsDeletingId(id);
    try {
      const { error } = await supabase.from("lookbook_items").delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      console.error("Error deleting lookbook item:", err);
      alert("Error al eliminar el elemento: " + (err?.message || "Error desconocido"));
    } finally {
      setIsDeletingId(null);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "png";
    const fileName = `lookbook/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("lookbook-images").upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data: publicUrlData } = supabase.storage.from("lookbook-images").getPublicUrl(fileName);
    return publicUrlData?.publicUrl || null;
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim()) {
      alert("Por favor ingresa un título.");
      return;
    }
    if (!addImageUrl.trim() && !addImageFile) {
      alert("Por favor agrega una imagen (archivo o URL).");
      return;
    }

    setIsUploading(true);
    try {
      let finalImageUrl = addImageUrl.trim();
      if (addImageFile) {
        const uploaded = await uploadImage(addImageFile);
        if (!uploaded) {
          alert('No se pudo subir la imagen. Verifica que el bucket "lookbook-images" exista en Supabase Storage.');
          return;
        }
        finalImageUrl = uploaded;
      }

      const { error } = await supabase.from("lookbook_items").insert({
        title: addTitle.trim(),
        category: addCategory,
        image_url: finalImageUrl,
        likes_count: 0,
      });
      if (error) throw error;

      setAddTitle("");
      setAddCategory("nails");
      setAddImageUrl("");
      setAddImageFile(null);
      setIsAddModalOpen(false);
      await loadItems();
    } catch (err: any) {
      console.error("Error adding lookbook item:", err);
      alert("Error al agregar el elemento: " + (err?.message || "Error desconocido"));
    } finally {
      setIsUploading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (activeFilter === "all") return true;
    return item.category === activeFilter;
  });

  return (
    <div className="pt-24 sm:pt-28 px-4 sm:px-6 lg:px-8 pb-20 min-h-screen max-w-6xl lg:max-w-7xl mx-auto space-y-8">
      <div className="text-center pt-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary bg-brand-primary/10 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-2 border border-brand-primary/20">
          <Sparkles className="w-4 h-4 stroke-[1.5]" />
          Book de Mili
        </span>

        {isAdmin && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-light text-white font-medium text-xs uppercase tracking-widest rounded-2xl flex items-center gap-2 shadow-2xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2]" />
              Agregar elemento
            </button>
            <button
              onClick={loadItems}
              className="px-4 py-2.5 bg-white hover:bg-brand-secondary text-brand-tertiary border border-brand-outline/20 font-medium text-xs uppercase tracking-widest rounded-2xl flex items-center gap-2 shadow-2xs transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4 stroke-[2]" />
              Recargar
            </button>
          </div>
        )}

        {itemsError && (
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <AlertCircle className="w-4 h-4" />
            {itemsError}
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1.5 justify-start sm:justify-center no-scrollbar border-b border-brand-outline/10">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition-all duration-200 ${
            activeFilter === "all"
              ? "bg-brand-tertiary text-white shadow-2xs"
              : "bg-white/80 text-brand-tertiary/60 border border-brand-outline/10 hover:text-brand-tertiary hover:border-brand-outline/30"
          }`}
        >
          Todos ({items.length})
        </button>
        <button
          onClick={() => setActiveFilter("nails")}
          className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition-all duration-200 ${
            activeFilter === "nails"
              ? "bg-brand-tertiary text-white shadow-2xs"
              : "bg-white/80 text-brand-tertiary/60 border border-brand-outline/10 hover:text-brand-tertiary hover:border-brand-outline/30"
          }`}
        >
          Manicure
        </button>
        <button
          onClick={() => setActiveFilter("lashes")}
          className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition-all duration-200 ${
            activeFilter === "lashes"
              ? "bg-brand-tertiary text-white shadow-2xs"
              : "bg-white/80 text-brand-tertiary/60 border border-brand-outline/10 hover:text-brand-tertiary hover:border-brand-outline/30"
          }`}
        >
          Cejas & Pestañas
        </button>
        <button
          onClick={() => setActiveFilter("studio")}
          className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition-all duration-200 ${
            activeFilter === "studio"
              ? "bg-brand-tertiary text-white shadow-2xs"
              : "bg-white/80 text-brand-tertiary/60 border border-brand-outline/10 hover:text-brand-tertiary hover:border-brand-outline/30"
          }`}
        >
          El Studio
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5">
        {filteredItems.map((item) => {
          const isLiked = likedItems[item.id];
          const count = likesCount[item.id] || 35;

          return (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="group relative bg-stone-100 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 border border-brand-outline/10 hover:border-brand-primary/30 shadow-2xs hover:shadow-md flex flex-col"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-stone-200">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/20 opacity-40 group-hover:opacity-75 transition-opacity duration-300" />
                <div className="absolute top-2 left-2 z-10">
                  <span className="bg-white/85 backdrop-blur-md text-brand-tertiary text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md shadow-2xs">
                    {item.tag}
                  </span>
                </div>
                <button
                  onClick={(e) => handleToggleLike(item.id, e)}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 backdrop-blur-md text-brand-tertiary hover:bg-white transition-all shadow-2xs active:scale-90"
                >
                  <Heart className={`w-3 h-3 transition-colors ${isLiked ? "fill-rose-500 text-rose-500" : "text-stone-600 stroke-[1.5]"}`} />
                </button>
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.id);
                    }}
                    disabled={isDeletingId === item.id}
                    title="Eliminar elemento"
                    className="absolute bottom-2 right-2 z-20 p-1.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-red-500 transition-all shadow-2xs active:scale-90 disabled:opacity-50"
                  >
                    {isDeletingId === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                <div className="absolute bottom-2 left-2 right-2 z-10 text-white flex items-end justify-between gap-1">
                  <div className="min-w-0 pr-1">
                    <h3 className="font-serif italic text-xs sm:text-sm font-normal truncate leading-tight drop-shadow-xs">
                      {item.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-[10px] text-white/90 bg-black/30 backdrop-blur-xs px-1.5 py-0.5 rounded-md">
                    <Heart className="w-2.5 h-2.5 fill-rose-400 text-rose-400" />
                    <span>{count}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden border border-brand-outline/20 max-h-[90vh] flex flex-col">
            <div className="relative h-64 sm:h-72 bg-stone-950 shrink-0">
              <img
                src={selectedItem.imageUrl}
                alt={selectedItem.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-stone-950/30" />
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-md"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="bg-white/90 backdrop-blur-md text-brand-tertiary text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
                  {selectedItem.tag}
                </span>
              </div>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <h3 className="font-serif italic text-2xl font-normal leading-tight">{selectedItem.title}</h3>
                {selectedItem.duration && (
                  <span className="text-xs text-white/75 font-light block mt-1">
                    ⏱️ Duración estimada: {selectedItem.duration}
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-brand-tertiary flex-1">
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-primary mb-1">
                  Detalles del Trabajo
                </h4>
                <p className="text-sm font-light text-brand-tertiary leading-relaxed">{selectedItem.subtitle}</p>
              </div>

              {selectedItem.details && (
                <div className="p-4 bg-brand-secondary/60 rounded-2xl border border-brand-outline/15 text-xs text-brand-tertiary/80 space-y-2">
                  <span className="font-semibold text-[10px] uppercase tracking-wider text-brand-tertiary block">
                    ¿Qué incluye este procedimiento?
                  </span>
                  <p className="leading-relaxed font-light">{selectedItem.details}</p>
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button
                  onClick={async () => {
                    const targetId = await resolveServiceIdForBooking(selectedItem!);
                    setSelectedItem(null);
                    if (targetId) {
                      setBookingServiceId(targetId);
                    } else {
                      alert("No hay servicios disponibles para reservar en este momento.");
                    }
                  }}
                  className="w-full bg-brand-primary hover:bg-brand-primary-light text-white py-3.5 rounded-2xl font-medium text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                >
                  <Sparkles className="w-4 h-4 stroke-[1.5]" />
                  <span>Reservar Servicio Similar</span>
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="w-full bg-brand-secondary text-brand-tertiary py-3 rounded-2xl font-medium text-xs uppercase tracking-widest hover:bg-brand-secondary-dark transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bookingServiceId && (
        <ReservationModal
          isOpen={true}
          onClose={() => setBookingServiceId(null)}
          initialServiceId={bookingServiceId}
        />
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden border border-brand-outline/20 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-brand-outline/10 p-4 sm:p-5">
              <h3 className="font-serif italic text-xl text-brand-tertiary">Agregar elemento al Lookbook</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-brand-tertiary/60 hover:text-brand-tertiary rounded-full hover:bg-brand-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-brand-tertiary/60 uppercase mb-1.5">Título *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Manicura Rusa & Rubber Base"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="w-full bg-brand-secondary/40 p-3 rounded-xl border border-brand-outline/20 text-sm outline-none focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-tertiary/60 uppercase mb-1.5">Categoría *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["nails", "lashes", "studio"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAddCategory(cat)}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                        addCategory === cat
                          ? "bg-brand-primary text-white border-brand-primary"
                          : "bg-white text-brand-tertiary/70 border-brand-outline/20 hover:border-brand-primary/40"
                      }`}
                    >
                      {cat === "nails" ? "Uñas" : cat === "lashes" ? "Cejas & Pest." : "Studio"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-tertiary/60 uppercase mb-1.5">Imagen (Archivo) *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setAddImageFile(file);
                    if (file) setAddImageUrl("");
                  }}
                  className="w-full bg-brand-secondary/40 p-3 rounded-xl border border-brand-outline/20 text-xs outline-none focus:border-brand-primary file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-brand-primary/10 file:text-brand-primary file:text-xs file:font-bold"
                />
              </div>

              <div className="flex items-center gap-2 text-[11px] text-brand-tertiary/50 font-bold uppercase">
                <span className="h-px flex-1 bg-brand-outline/10" />
                o por URL
                <span className="h-px flex-1 bg-brand-outline/10" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-tertiary/60 uppercase mb-1.5">Imagen (URL)</label>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/imagen.jpg"
                  value={addImageUrl}
                  onChange={(e) => {
                    setAddImageUrl(e.target.value);
                    if (e.target.value) setAddImageFile(null);
                  }}
                  className="w-full bg-brand-secondary/40 p-3 rounded-xl border border-brand-outline/20 text-xs outline-none focus:border-brand-primary"
                />
              </div>

              {(addImageFile || addImageUrl) && (
                <div className="rounded-xl overflow-hidden border border-brand-outline/20 h-32">
                  <img
                    src={addImageFile ? URL.createObjectURL(addImageFile) : addImageUrl}
                    alt="Vista previa"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 bg-brand-secondary text-brand-tertiary rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-brand-secondary-dark"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-brand-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {isUploading ? "Guardando..." : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}