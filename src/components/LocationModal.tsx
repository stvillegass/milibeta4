import { useState } from 'react';
import { MapPin, Navigation, Copy, Check, X, ExternalLink, ChevronDown } from 'lucide-react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  studioName?: string;
  studioAddress?: string;
  mapsUrl?: string;
}

export default function LocationModal({
  isOpen,
  onClose,
  studioName = "Milibeauty",
  studioAddress = "Av. Principal Las Mercedes, Edificio Centro Empresarial, Piso 3, Local 302",
  mapsUrl
}: LocationModalProps) {
  const [copied, setCopied] = useState(false);
  const [showAddress, setShowAddress] = useState(false);

  if (!isOpen) return null;

  const defaultGoogleMaps = mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(studioName + " " + studioAddress)}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(studioName + " " + studioAddress)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(studioAddress || studioName)}&navigate=yes`;

  const handleCopy = () => {
    navigator.clipboard.writeText(studioAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-brand-outline/20 space-y-3 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar: Address Button + Close Button aligned */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowAddress(!showAddress)}
            className="flex-1 flex items-center justify-between px-3.5 py-2 bg-brand-secondary/60 hover:bg-brand-secondary rounded-xl border border-brand-outline/20 text-xs font-medium text-brand-tertiary transition-all duration-200"
          >
            <span className="flex items-center gap-1.5 text-brand-primary font-medium text-[11px]">
              <MapPin className="w-3.5 h-3.5 stroke-[1.75] shrink-0" />
              <span>{showAddress ? 'Ocultar dirección' : 'Ver dirección escrita'}</span>
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-brand-tertiary/60 transition-transform duration-300 stroke-[1.5] shrink-0 ${showAddress ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={onClose}
            className="p-2 text-brand-tertiary/50 hover:text-brand-tertiary hover:bg-brand-secondary rounded-xl transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Collapsible Address Content */}
        {showAddress && (
          <div className="bg-brand-secondary/60 p-3.5 rounded-2xl border border-brand-outline/20 space-y-2 animate-in fade-in duration-200">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-tertiary/60 block">
              Dirección del Studio ({studioName})
            </span>
            <p className="text-xs text-brand-tertiary leading-relaxed font-normal">
              {studioAddress}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-1 text-[11px] font-medium text-brand-primary hover:text-brand-primary-light flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">¡Dirección copiada al portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar dirección</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Maps Action Buttons */}
        <div>
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={defaultGoogleMaps}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand-primary hover:bg-brand-primary-light text-white py-3.5 px-3 rounded-2xl text-xs font-medium uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 transition-all shadow-xs active:scale-[0.98] group"
              title={`Iniciar ruta en Google Maps a ${studioName}`}
            >
              <div className="flex items-center gap-1.5">
                <Navigation className="w-4 h-4 stroke-[1.75]" />
                <span className="font-semibold text-[11px] tracking-wider">Google Maps</span>
              </div>
              <span className="text-[9px] text-white/70 font-light normal-case flex items-center gap-0.5 group-hover:text-white">
                Ir ahora <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </a>

            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-stone-900 hover:bg-stone-800 text-white py-3.5 px-3 rounded-2xl text-xs font-medium uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 transition-all shadow-xs active:scale-[0.98] group"
              title={`Iniciar ruta en Apple Maps a ${studioName}`}
            >
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 fill-current text-white shrink-0 -mt-0.5" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.85c.67-.82 1.12-1.96.99-3.1-.97.04-2.15.65-2.84 1.45-.61.71-1.15 1.87-1.01 2.98 1.09.08 2.2-.51 2.86-1.33z"/>
                </svg>
                <span className="font-semibold text-[11px] tracking-wider">Apple Maps</span>
              </div>
              <span className="text-[9px] text-white/70 font-light normal-case flex items-center gap-0.5 group-hover:text-white">
                Ir ahora <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
