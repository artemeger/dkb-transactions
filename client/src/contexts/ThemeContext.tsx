import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Storage keys
const THEME_STORAGE_KEY = 'dkb-theme-preference';
const SYSTEM_PREFERENCE_MEDIATION_KEY = 'dkb-system-pref-checked';

function getSystemPreference(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark'; // Default to dark
}

function loadThemeFromStorage(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // First try saved preference
    const stored = loadThemeFromStorage();
    if (stored) return stored;
    
    // Check if we've checked system preference before
    const hasChecked = sessionStorage.getItem(SYSTEM_PREFERENCE_MEDIATION_KEY);
    if (!hasChecked) {
      // On first visit, use system preference and remember it
      const systemPref = getSystemPreference();
      localStorage.setItem(THEME_STORAGE_KEY, systemPref);
      sessionStorage.setItem(SYSTEM_PREFERENCE_MEDIATION_KEY, 'true');
      return systemPref;
    }
    
    // Fall back to system preference
    return getSystemPreference();
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  };

  // Apply theme class to body (not html - more reliable)
  useEffect(() => {
    const body = document.body;
    if (theme === 'light') {
      body.classList.add('theme-light');
      body.classList.remove('theme-dark');
      // Also apply to html for broader compatibility
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('theme-dark');
    } else {
      body.classList.add('theme-dark');
      body.classList.remove('theme-light');
      document.documentElement.classList.add('theme-dark');
      document.documentElement.classList.remove('theme-light');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
