"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Languages, Moon, Sun } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Language, useLanguage } from "./language-provider";
import { useTheme } from "./theme-provider";

type UserRole = "user" | "admin";

export function AppShell({ children }: PropsWithChildren) {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("user");
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchRole = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          return;
        }
        const data: { user?: { role?: string } | null } = await response.json();
        const role =
          data.user && (data.user.role === "admin" || data.user.role === "user")
            ? (data.user.role as UserRole)
            : "user";
        if (!cancelled) {
          setUserRole(role);
        }
      } catch (error) {
        console.error("Failed to load current user role", error);
      } finally {
        if (!cancelled) {
          setRoleLoaded(true);
        }
      }
    };
    void fetchRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo(
    () => [
      { href: "/", label: t.nav.qa, roles: ["user", "admin"] as UserRole[] },
      { href: "/chat", label: t.nav.chat, roles: ["user", "admin"] },
      { href: "/library", label: t.nav.library, roles: ["admin"] as UserRole[] },
      { href: "/settings", label: t.nav.settings, roles: ["admin"] as UserRole[] },
      { href: "/users", label: t.nav.users, roles: ["admin"] as UserRole[] },
    ],
    [t]
  );

  const allowedNavItems = useMemo(
    () => navItems.filter((item) => item.roles.includes(userRole)),
    [navItems, userRole]
  );

  useEffect(() => {
    if (!roleLoaded) return;
    const allowedPaths = new Set(allowedNavItems.map((item) => item.href));
    if (!allowedPaths.has(pathname)) {
      const fallback = allowedNavItems[0]?.href ?? "/";
      router.replace(fallback);
    }
  }, [allowedNavItems, pathname, roleLoaded, router]);

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
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors">
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 -z-10 opacity-90 transition-colors",
          isLight
            ? "bg-[radial-gradient(circle_at_top,_rgba(120,70,255,0.16),_rgba(255,255,255,0.9))]"
            : "bg-[radial-gradient(circle_at_top,_rgba(120,70,255,0.32),_rgba(2,6,23,0.95))]"
        )}
        aria-hidden
      />
      <div className="motion-aurora" aria-hidden>
        <div
          className={clsx(
            "aurora-veil",
            isLight ? "aurora-veil--light" : "aurora-veil--dark"
          )}
        />
        <div
          className="glow-orb glow-orb--violet"
          style={{ top: "-24%", right: "-16%" }}
        />
        <div
          className="glow-orb glow-orb--teal"
          style={{ bottom: "-26%", left: "-18%", animationDelay: "0.6s" }}
        />
        <div
          className="glow-orb glow-orb--rose"
          style={{ top: "32%", left: "22%", animationDuration: "24s" }}
        />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-8 py-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-slide-up">
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
        <div className="grid flex-1 gap-10 lg:grid-cols-[260px_1fr] animate-slide-delayed">
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
              {allowedNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "nav-backlight group flex items-center gap-3 rounded-2xl border px-4 py-3 text-base font-medium transition-colors",
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
                    )}
                  >
                    <span className="transition-colors duration-200 group-hover:text-white">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="flex-1">
            <div key={pathname} className="grid gap-8 route-transition">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
