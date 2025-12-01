'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
      { href: '/library', label: t.nav.library },
      { href: '/settings', label: t.nav.settings },
    ],
    [t]
  );

  const languageOptions = useMemo(
    () => [
      { value: 'en' as Language, label: t.layout.language.en },
      { value: 'zh' as Language, label: t.layout.language.zh },
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
            <Select
              value={language}
              onValueChange={(value) => setLanguage(value as Language)}
              disabled={isLoggingOut}
            >
              <SelectTrigger
                aria-label={t.layout.language.label}
                size="sm"
                className="min-w-[120px] rounded-lg border-white/10 bg-slate-900/70 text-white/90 shadow-inner shadow-violet-500/20 data-[placeholder]:text-white/70"
              >
                <SelectValue placeholder={t.layout.language.label} />
              </SelectTrigger>
              <SelectContent className="min-w-[140px] border-white/10 bg-slate-950/95 text-white">
                {languageOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-sm text-white/90"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
