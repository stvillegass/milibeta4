import React from 'react';

interface ServiceVectorHeaderProps {
  category: string;
  name: string;
  duration?: string;
}

export default function ServiceVectorHeader({ category, name, duration }: ServiceVectorHeaderProps) {
  const normalizedName = name.toLowerCase();
  
  // Determine illustration type based on category or service name
  const isLashes = category === 'lashes' || normalizedName.includes('pestaña') || normalizedName.includes('ceja') || normalizedName.includes('lash') || normalizedName.includes('lifting');
  const isPedicure = normalizedName.includes('pedicura') || normalizedName.includes('pies');

  return (
    <div className="h-44 relative overflow-hidden bg-gradient-to-br from-[#282320] via-[#1C1917] to-[#12100E] border-b border-brand-outline/10 flex items-center justify-center select-none group">
      {/* Background Subtle Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(197,160,101,0.18)_0%,transparent_70%)] pointer-events-none" />
      
      {/* Delicate background geometry lines */}
      <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center">
        <div className="w-56 h-56 rounded-full border border-brand-primary/40 scale-90 group-hover:scale-100 transition-transform duration-700 ease-out" />
        <div className="absolute w-40 h-40 rounded-full border border-dashed border-brand-primary/30 rotate-45 group-hover:rotate-90 transition-transform duration-1000 ease-out" />
      </div>

      {/* Vector Artwork Container */}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-6 transition-transform duration-500 group-hover:scale-105">
        {isLashes ? (
          /* Lashes & Brows Minimalist Vector Silhouette */
          <svg className="w-36 h-28 text-brand-primary drop-shadow-[0_4px_12px_rgba(197,160,101,0.25)]" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Sculpted Eyebrow Silhouette */}
            <path 
              d="M 30 35 C 50 20, 95 18, 130 32 C 115 28, 70 24, 30 35 Z" 
              fill="url(#goldGradient)" 
            />
            {/* Eye Contour Arc */}
            <path 
              d="M 35 62 C 60 48, 100 48, 125 62" 
              stroke="url(#goldGradient)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />
            {/* Delicate Lashes - Upward Curved Silhouettes */}
            <path d="M 42 60 C 38 48, 30 40, 24 36" stroke="url(#goldGradient)" strokeWidth="2" strokeLinecap="round" />
            <path d="M 52 56 C 50 42, 44 32, 38 26" stroke="url(#goldGradient)" strokeWidth="2" strokeLinecap="round" />
            <path d="M 64 53 C 64 38, 60 26, 56 18" stroke="url(#goldGradient)" strokeWidth="2" strokeLinecap="round" />
            <path d="M 78 52 C 80 36, 78 24, 76 16" stroke="url(#goldGradient)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 92 53 C 96 38, 98 26, 98 18" stroke="url(#goldGradient)" strokeWidth="2" strokeLinecap="round" />
            <path d="M 106 56 C 112 42, 118 32, 122 26" stroke="url(#goldGradient)" strokeWidth="2" strokeLinecap="round" />
            <path d="M 118 60 C 126 48, 132 40, 138 36" stroke="url(#goldGradient)" strokeWidth="1.8" strokeLinecap="round" />
            
            {/* Subtle Iris Reflection Dot */}
            <circle cx="80" cy="72" r="2.5" fill="#C5A065" opacity="0.6" />
            <path d="M 65 70 C 72 75, 88 75, 95 70" stroke="#C5A065" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.4" />

            {/* Sparkle accents */}
            <path d="M 140 22 L 142 26 L 146 28 L 142 30 L 140 34 L 138 30 L 134 28 L 138 26 Z" fill="#D8B47A" opacity="0.8" />
            <path d="M 22 50 L 23 53 L 26 54 L 23 55 L 22 58 L 21 55 L 18 54 L 21 53 Z" fill="#D8B47A" opacity="0.6" />

            {/* Gradients */}
            <defs>
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D8B47A" />
                <stop offset="50%" stopColor="#C5A065" />
                <stop offset="100%" stopColor="#9E7A43" />
              </linearGradient>
            </defs>
          </svg>
        ) : isPedicure ? (
          /* Spa / Pedicure Vector Silhouette */
          <svg className="w-32 h-28 text-brand-primary drop-shadow-[0_4px_12px_rgba(197,160,101,0.25)]" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 80 25 C 65 40, 50 60, 55 85 C 60 100, 80 105, 80 105 C 80 105, 100 100, 105 85 C 110 60, 95 40, 80 25 Z" stroke="url(#goldGradientNails)" strokeWidth="2" fill="url(#goldGradientNails)" fillOpacity="0.1" />
            <path d="M 80 35 C 72 48, 62 62, 66 80" stroke="url(#goldGradientNails)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 80 35 C 88 48, 98 62, 94 80" stroke="url(#goldGradientNails)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="80" cy="92" r="3" fill="#D8B47A" />
            <defs>
              <linearGradient id="goldGradientNails" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D8B47A" />
                <stop offset="100%" stopColor="#C5A065" />
              </linearGradient>
            </defs>
          </svg>
        ) : (
          /* Nails / Manicure Minimalist Vector Silhouette */
          <svg className="w-36 h-28 text-brand-primary drop-shadow-[0_4px_12px_rgba(197,160,101,0.25)]" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Hand & Finger Line Art Silhouette */}
            {/* Nail 1 (Index) */}
            <path d="M 45 42 C 45 32, 52 28, 55 28 C 58 28, 65 32, 65 42 L 65 65 C 65 65, 55 67, 45 65 Z" fill="url(#goldGradientNails)" fillOpacity="0.2" stroke="url(#goldGradientNails)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M 48 35 C 48 30, 52 29, 55 29 C 58 29, 62 30, 62 35 L 62 45 C 62 45, 55 46, 48 45 Z" fill="url(#goldGradientNails)" />
            
            {/* Nail 2 (Middle - Longer, almond shaped) */}
            <path d="M 72 32 C 72 18, 80 14, 83 14 C 86 14, 94 18, 94 32 L 94 62 C 94 62, 83 64, 72 62 Z" fill="url(#goldGradientNails)" fillOpacity="0.2" stroke="url(#goldGradientNails)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M 75 25 C 75 19, 80 16, 83 16 C 86 16, 91 19, 91 25 L 91 38 C 91 38, 83 39, 75 38 Z" fill="url(#goldGradientNails)" />

            {/* Nail 3 (Ring) */}
            <path d="M 101 40 C 101 28, 108 24, 111 24 C 114 24, 121 28, 121 40 L 121 65 C 121 65, 111 67, 101 65 Z" fill="url(#goldGradientNails)" fillOpacity="0.2" stroke="url(#goldGradientNails)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M 104 33 C 104 27, 108 25, 111 25 C 114 25, 118 27, 118 33 L 118 43 C 118 43, 111 44, 104 43 Z" fill="url(#goldGradientNails)" />

            {/* Hand Contour Base Arc */}
            <path d="M 35 80 C 45 72, 125 72, 135 80" stroke="url(#goldGradientNails)" strokeWidth="2" strokeLinecap="round" />
            <path d="M 25 98 C 50 88, 120 88, 145 98" stroke="url(#goldGradientNails)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.5" />

            {/* Sparkles */}
            <path d="M 83 5 L 84.5 9 L 88.5 10.5 L 84.5 12 L 83 16 L 81.5 12 L 77.5 10.5 L 81.5 9 Z" fill="#D8B47A" />
            <path d="M 135 30 L 136 33 L 139 34 L 136 35 L 135 38 L 134 35 L 131 34 L 134 33 Z" fill="#D8B47A" opacity="0.7" />

            <defs>
              <linearGradient id="goldGradientNails" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D8B47A" />
                <stop offset="50%" stopColor="#C5A065" />
                <stop offset="100%" stopColor="#9B7841" />
              </linearGradient>
            </defs>
          </svg>
        )}
      </div>

      {/* Duration badge */}
      {duration && (
        <div className="absolute top-3.5 right-3.5 bg-[#1C1917]/85 backdrop-blur-md text-brand-primary border border-brand-primary/30 text-[10px] font-medium tracking-wider px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
          <span className="text-[11px]">⏱</span>
          <span>{duration}</span>
        </div>
      )}
    </div>
  );
}
