'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { Language, useLanguage } from './language-provider';
import { Select } from './select';

export function AppShell({ children }: PropsWithChildren) {
  const { t, language, setLanguage } = useLanguage();
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
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(120,70,255,0.32),_rgba(2,6,23,0.95))]"
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
              options={languageOptions}
              onChange={setLanguage}
              ariaLabel={t.layout.language.label}
              triggerClassName="whitespace-nowrap px-2"
              listClassName="min-w-[120px]"
              optionClassName="!flex-row !items-center whitespace-nowrap"
            />
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-violet-500/30 transition hover:brightness-110 disabled:opacity-70 disabled:brightness-100"
            >
              {isLoggingOut ? t.layout.loggingOut : t.layout.logout}
            </button>
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
