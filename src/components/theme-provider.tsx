'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);

  const applyTheme = useCallback((next: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore write failures (e.g., private mode)
    }
    setThemeState(next);
  }, []);

  useEffect(() => {
    const stored = typeof window !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEY) as Theme | null)
      : null;
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const initial = stored ?? (prefersDark ? 'dark' : 'light');
    applyTheme(initial);
    setReady(true);
  }, [applyTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      applyTheme(next);
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
