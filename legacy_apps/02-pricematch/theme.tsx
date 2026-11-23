import React, { createContext, useContext, useState } from 'react';

export type ThemeId = 'slate' | 'navy' | 'emerald' | 'warm' | 'bordeaux';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  swatches: {
    primary: string;
    accent: string;
    bg: string;
  };
  classes: {
    primaryBtn: string;
    primaryBtnHover: string;
    brandBadge: string;
    brandBadgeText: string;
    activeNav: string;
    accentText: string;
    accentBgLight: string;
    accentBorder: string;
    sliderAccent: string;
    iconBg: string;
    iconText: string;
    subtleRing: string;
  };
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  slate: {
    id: 'slate',
    name: 'Slate Minimal',
    tagline: 'Modern monochromatic slate and clean neutrals',
    swatches: {
      primary: '#0F172A',
      accent: '#475569',
      bg: '#F8F9FA',
    },
    classes: {
      primaryBtn: 'bg-slate-900 text-white hover:bg-slate-800',
      primaryBtnHover: 'hover:bg-slate-800',
      brandBadge: 'bg-slate-900 text-white',
      brandBadgeText: 'text-white',
      activeNav: 'bg-slate-900 text-white shadow-2xs',
      accentText: 'text-slate-900',
      accentBgLight: 'bg-slate-100',
      accentBorder: 'border-slate-300',
      sliderAccent: 'accent-slate-900',
      iconBg: 'bg-slate-900',
      iconText: 'text-white',
      subtleRing: 'focus:ring-slate-900',
    },
  },
  navy: {
    id: 'navy',
    name: 'Midnight Navy',
    tagline: 'Corporate executive deep blue with sharp clarity',
    swatches: {
      primary: '#0F2744',
      accent: '#2563EB',
      bg: '#F4F7FB',
    },
    classes: {
      primaryBtn: 'bg-blue-950 text-white hover:bg-blue-900',
      primaryBtnHover: 'hover:bg-blue-900',
      brandBadge: 'bg-blue-950 text-white',
      brandBadgeText: 'text-white',
      activeNav: 'bg-blue-950 text-white shadow-2xs',
      accentText: 'text-blue-900',
      accentBgLight: 'bg-blue-50',
      accentBorder: 'border-blue-300',
      sliderAccent: 'accent-blue-900',
      iconBg: 'bg-blue-950',
      iconText: 'text-white',
      subtleRing: 'focus:ring-blue-900',
    },
  },
  emerald: {
    id: 'emerald',
    name: 'Forest Emerald',
    tagline: 'Fresh organic deep evergreen & botanic accents',
    swatches: {
      primary: '#064E3B',
      accent: '#059669',
      bg: '#F5F9F6',
    },
    classes: {
      primaryBtn: 'bg-emerald-950 text-white hover:bg-emerald-900',
      primaryBtnHover: 'hover:bg-emerald-900',
      brandBadge: 'bg-emerald-950 text-white',
      brandBadgeText: 'text-white',
      activeNav: 'bg-emerald-950 text-white shadow-2xs',
      accentText: 'text-emerald-900',
      accentBgLight: 'bg-emerald-50',
      accentBorder: 'border-emerald-300',
      sliderAccent: 'accent-emerald-900',
      iconBg: 'bg-emerald-950',
      iconText: 'text-white',
      subtleRing: 'focus:ring-emerald-900',
    },
  },
  warm: {
    id: 'warm',
    name: 'Warm Espresso & Amber',
    tagline: 'Sophisticated dark stone with rich amber highlights',
    swatches: {
      primary: '#1C1917',
      accent: '#D97706',
      bg: '#FAF9F6',
    },
    classes: {
      primaryBtn: 'bg-stone-900 text-white hover:bg-stone-800',
      primaryBtnHover: 'hover:bg-stone-800',
      brandBadge: 'bg-stone-900 text-amber-300',
      brandBadgeText: 'text-amber-300',
      activeNav: 'bg-stone-900 text-white shadow-2xs',
      accentText: 'text-stone-900',
      accentBgLight: 'bg-stone-100',
      accentBorder: 'border-stone-300',
      sliderAccent: 'accent-stone-900',
      iconBg: 'bg-stone-900',
      iconText: 'text-amber-400',
      subtleRing: 'focus:ring-stone-900',
    },
  },
  bordeaux: {
    id: 'bordeaux',
    name: 'Bordeaux Luxury',
    tagline: 'Deep refined wine tone with balanced contrast',
    swatches: {
      primary: '#4C0519',
      accent: '#BE123C',
      bg: '#FAFAF9',
    },
    classes: {
      primaryBtn: 'bg-rose-950 text-white hover:bg-rose-900',
      primaryBtnHover: 'hover:bg-rose-900',
      brandBadge: 'bg-rose-950 text-white',
      brandBadgeText: 'text-white',
      activeNav: 'bg-rose-950 text-white shadow-2xs',
      accentText: 'text-rose-950',
      accentBgLight: 'bg-rose-50',
      accentBorder: 'border-rose-300',
      sliderAccent: 'accent-rose-950',
      iconBg: 'bg-rose-950',
      iconText: 'text-rose-200',
      subtleRing: 'focus:ring-rose-950',
    },
  },
};

interface ThemeContextType {
  currentTheme: ThemeDefinition;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  availableThemes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultThemeId?: ThemeId;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, defaultThemeId = 'slate' }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem('kwik_stop_theme') as ThemeId | null;
      if (saved && THEMES[saved]) {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return THEMES[defaultThemeId] ? defaultThemeId : 'slate';
  });

  const setThemeId = (id: ThemeId) => {
    if (THEMES[id]) {
      setThemeIdState(id);
      try {
        localStorage.setItem('kwik_stop_theme', id);
      } catch {
        // Ignore storage errors
      }
    }
  };

  const currentTheme = THEMES[themeId] || THEMES.slate;

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        themeId,
        setThemeId,
        availableThemes: Object.values(THEMES),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
