'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { Languages, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Language, useLanguage } from './language-provider';
import { useTheme } from './theme-provider';

export function AppShell({ children }: PropsWithChildren) {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = useMemo(
    () => [
      { href: '/', label: t.nav.qa },
      { href: '/chat', label: t.nav.chat },
      { href: '/library', label: t.nav.library },
      { href: '/settings', label: t.nav.settings },
    ],
    [t]
  );

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        console.error('Failed to log out', await response.text());
      }
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Failed to log out', error);
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, router]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? ('zh' as Language) : ('en' as Language));
  }, [language, setLanguage]);

  return (
    <div
      className={`relative min-h-screen transition-colors ${
        isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 -z-10 transition-colors ${
          isLight
            ? 'bg-[radial-gradient(circle_at_top,_rgba(120,70,255,0.12),_rgba(255,255,255,0.95))]'
            : 'bg-[radial-gradient(circle_at_top,_rgba(120,70,255,0.32),_rgba(2,6,23,0.95))]'
        }`}
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-8 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-semibold text-white">{t.layout.brand}</h1>
            <p className="text-sm uppercase tracking-[0.32em] text-purple-200/80">
              {t.layout.tagline}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={toggleLanguage}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 text-white/80 transition hover:border-violet-300/60 hover:text-white"
              aria-label={t.layout.language.label}
              aria-pressed={language === 'zh'}
              title={language === 'en' ? t.layout.language.zh : t.layout.language.en}
            >
              <Languages className="size-4" />
              <span className="text-xs font-semibold tracking-wide">
                {language === 'en' ? 'EN' : '中'}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={toggleTheme}
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 transition hover:border-violet-300/60 hover:text-white"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <Button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="cta"
              size="pill-sm"
              className="font-semibold"
            >
              {isLoggingOut ? t.layout.loggingOut : t.layout.logout}
            </Button>
          </div>
        </header>
        <div className="grid flex-1 gap-10 lg:grid-cols-[260px_1fr]">
          <aside className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-slate-900/50 p-6 shadow-2xl shadow-purple-900/20 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-100/80">
              {t.layout.menuLabel}
            </p>
            <nav className="space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-base font-medium transition-all ${
                      isActive
                        ? 'border-violet-300/80 bg-gradient-to-r from-violet-500 to-indigo-500 text-slate-950 shadow-lg shadow-violet-500/40'
                        : 'border-white/10 bg-white/5 text-white/80 hover:border-violet-300/60 hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="flex-1 pb-24">
            <div className="grid gap-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
