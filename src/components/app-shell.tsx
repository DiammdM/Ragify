"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useCallback, useMemo, useState } from "react";
import { Languages, Moon, Sun } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Language, useLanguage } from "./language-provider";
import { useTheme } from "./theme-provider";

export function AppShell({ children }: PropsWithChildren) {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = useMemo(
    () => [
      { href: "/", label: t.nav.qa },
      { href: "/chat", label: t.nav.chat },
      { href: "/library", label: t.nav.library },
      { href: "/settings", label: t.nav.settings },
    ],
    [t]
  );

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        console.error("Failed to log out", await response.text());
      }
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Failed to log out", error);
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, router]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? ("zh" as Language) : ("en" as Language));
  }, [language, setLanguage]);

  const controlStyles = isLight
    ? "border-slate-200 bg-white/80 text-slate-800 shadow-sm hover:border-violet-200 hover:bg-violet-50 hover:text-slate-900"
    : "border-white/10 bg-white/10 text-white/80 hover:border-violet-300/60 hover:text-white";

  return (
    <div className="relative min-h-screen bg-background text-foreground transition-colors">
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 -z-10 transition-colors",
          isLight
            ? "bg-[radial-gradient(circle_at_top,_rgba(120,70,255,0.16),_rgba(255,255,255,0.9))]"
            : "bg-[radial-gradient(circle_at_top,_rgba(120,70,255,0.32),_rgba(2,6,23,0.95))]"
        )}
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-8 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-semibold text-foreground">
              {t.layout.brand}
            </h1>
            <p className="text-sm uppercase tracking-[0.32em] text-muted-foreground">
              {t.layout.tagline}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={toggleLanguage}
              className={clsx(
                "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold tracking-wide transition cursor-pointer",
                controlStyles
              )}
              aria-label={t.layout.language.label}
              aria-pressed={language === "zh"}
              title={
                language === "en" ? t.layout.language.zh : t.layout.language.en
              }
            >
              <Languages className="size-4" />
              <span className="text-xs font-semibold tracking-wide">
                {language === "en" ? "EN" : "中"}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={toggleTheme}
              className={clsx(
                "inline-flex size-10 items-center justify-center rounded-full transition cursor-pointer",
                controlStyles
              )}
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <Sun className="size-5" />
              ) : (
                <Moon className="size-5" />
              )}
            </Button>
            <Button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="cta"
              size="pill-sm"
              className="font-semibold cursor-pointer"
            >
              {isLoggingOut ? t.layout.loggingOut : t.layout.logout}
            </Button>
          </div>
        </header>
        <div className="grid flex-1 gap-10 lg:grid-cols-[260px_1fr]">
          <aside
            className={clsx(
              "flex flex-col gap-6 rounded-3xl border p-6 shadow-2xl backdrop-blur",
              isLight
                ? "border-slate-200/90 bg-white/85 text-foreground shadow-xl shadow-slate-900/10"
                : "border-white/10 bg-slate-900/50 text-white shadow-purple-900/20"
            )}
            style={{ height: "min(794px, calc(100vh - 220px))" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                        ? clsx(
                            "border bg-gradient-to-r shadow-lg border-violet-300/80",
                            isLight
                              ? "from-slate-500 via-slate-600 to-slate-700 text-white shadow-slate-800/35"
                              : "from-violet-500 to-indigo-600 text-slate-950 shadow-violet-500/40"
                          )
                        : isLight
                        ? "border-slate-200 bg-white/70 text-foreground/80 shadow-sm hover:border-violet-200 hover:bg-slate-300/80"
                        : "border-white/10 bg-white/5 text-white/80 hover:border-violet-300/60 hover:text-white"
                    }`}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="flex-1">
            <div className="grid gap-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
