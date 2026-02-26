"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Languages, Menu, Moon, Sun, X } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Language, useLanguage } from "./language-provider";
import { useTheme } from "./theme-provider";

type UserRole = "user" | "admin";
type NavGroup = "core" | "admin";
type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
  group: NavGroup;
};

export function AppShell({ children }: PropsWithChildren) {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("user");
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavPanelRef = useRef<HTMLElement>(null);
  const mobileNavWasOpenRef = useRef(false);

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

  const navItems = useMemo<NavItem[]>(
    () => [
      {
        href: "/",
        label: t.nav.qa,
        roles: ["user", "admin"],
        group: "core",
      },
      {
        href: "/chat",
        label: t.nav.chat,
        roles: ["user", "admin"],
        group: "core",
      },
      {
        href: "/library",
        label: t.nav.library,
        roles: ["admin"],
        group: "admin",
      },
      {
        href: "/settings",
        label: t.nav.settings,
        roles: ["admin"],
        group: "admin",
      },
      {
        href: "/users",
        label: t.nav.users,
        roles: ["admin"],
        group: "admin",
      },
    ],
    [t],
  );

  const allowedNavItems = useMemo(
    () => navItems.filter((item) => item.roles.includes(userRole)),
    [navItems, userRole],
  );

  const navSections = useMemo(() => {
    const coreItems = allowedNavItems.filter((item) => item.group === "core");
    const adminItems = allowedNavItems.filter((item) => item.group === "admin");
    return [
      { key: "core", label: t.layout.navGroups.core, items: coreItems },
      { key: "admin", label: t.layout.navGroups.admin, items: adminItems },
    ].filter((section) => section.items.length > 0);
  }, [allowedNavItems, t.layout.navGroups.admin, t.layout.navGroups.core]);

  useEffect(() => {
    if (!roleLoaded) return;
    const allowedPaths = new Set(allowedNavItems.map((item) => item.href));
    if (!allowedPaths.has(pathname)) {
      const fallback = allowedNavItems[0]?.href ?? "/";
      router.replace(fallback);
    }
  }, [allowedNavItems, pathname, roleLoaded, router]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  const getMobileFocusableElements = useCallback(() => {
    if (!mobileNavPanelRef.current) {
      return [] as HTMLElement[];
    }
    return Array.from(
      mobileNavPanelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    );
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) {
      if (mobileNavWasOpenRef.current) {
        mobileMenuButtonRef.current?.focus();
      }
      mobileNavWasOpenRef.current = false;
      return;
    }
    mobileNavWasOpenRef.current = true;
    const focusableElements = getMobileFocusableElements();
    focusableElements[0]?.focus();
  }, [getMobileFocusableElements, isMobileNavOpen]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const panel = mobileNavPanelRef.current;
      if (!panel) {
        return;
      }
      const focusableElements = getMobileFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (!activeElement || !panel.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [getMobileFocusableElements, isMobileNavOpen]);

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
    ? "border-violet-200 bg-white/82 text-indigo-900 shadow-sm hover:border-cyan-300 hover:bg-cyan-50 hover:text-indigo-950"
    : "border-white/10 bg-white/10 text-white/80 hover:border-violet-300/60 hover:text-white";

  const navItemStyles = useCallback(
    (isActive: boolean, mobile = false) =>
      clsx(
        "nav-backlight group flex items-center gap-3 rounded-2xl border px-4 py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        mobile && "text-sm",
        isActive
          ? clsx(
              "border shadow-lg",
              isLight
                ? "border-violet-300/80 bg-violet-600 text-white shadow-violet-500/35"
                : "border-violet-300/70 bg-violet-500 text-white shadow-violet-500/40",
            )
          : isLight
            ? "border-violet-200/80 bg-white/72 text-indigo-900/80 shadow-sm hover:border-cyan-300/80 hover:bg-violet-200/75"
            : "border-white/10 bg-white/5 text-white/80 hover:border-violet-300/60 hover:text-white",
      ),
    [isLight],
  );

  const renderNavigation = useCallback(
    (mobile = false) => (
      <nav className="space-y-5">
        {navSections.map((section) => (
          <div key={section.key} className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {section.label}
            </p>
            <div className="space-y-2">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={mobile ? () => setIsMobileNavOpen(false) : undefined}
                    aria-current={isActive ? "page" : undefined}
                    className={navItemStyles(isActive, mobile)}
                  >
                    <span className="transition-colors duration-200 group-hover:text-white">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    ),
    [navItemStyles, navSections, pathname],
  );

  const controlButtons = (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={toggleLanguage}
        className={clsx(
          "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold tracking-wide transition cursor-pointer",
          controlStyles,
        )}
        aria-label={t.layout.language.label}
        aria-pressed={language === "zh"}
        title={language === "en" ? t.layout.language.zh : t.layout.language.en}
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
          controlStyles,
        )}
        aria-label={t.layout.themeToggle}
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
    </>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors">
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 -z-10 opacity-90 transition-colors",
          isLight
            ? "bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.15),_rgba(250,245,255,0.94))]"
            : "bg-[radial-gradient(circle_at_top,_rgba(120,70,255,0.32),_rgba(2,6,23,0.95))]",
        )}
        aria-hidden
      />
      <div className="motion-aurora" aria-hidden>
        <div
          className={clsx(
            "aurora-veil",
            isLight ? "aurora-veil--light" : "aurora-veil--dark",
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
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="animate-slide-up space-y-4">
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <button
                ref={mobileMenuButtonRef}
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className={clsx(
                  "inline-flex size-10 items-center justify-center rounded-full border transition cursor-pointer lg:hidden",
                  controlStyles,
                )}
                aria-expanded={isMobileNavOpen}
                aria-controls="mobile-navigation"
                aria-label={t.layout.mobileMenu.open}
              >
                <Menu className="size-5" />
              </button>
              <div className="min-w-0 space-y-1">
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
                  {t.layout.brand}
                </h1>
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground sm:text-sm sm:tracking-[0.32em]">
                  {t.layout.tagline}
                </p>
              </div>
            </div>
            <div className="hidden items-center justify-end gap-3 sm:flex">
              {controlButtons}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 sm:hidden">
            {controlButtons}
          </div>
        </header>
        <div className="grid flex-1 gap-8 animate-slide-delayed lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside
            className={clsx(
              "hidden flex-col gap-6 rounded-3xl border p-6 shadow-2xl backdrop-blur lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto",
              isLight
                ? "border-violet-200/90 bg-white/86 text-foreground shadow-xl shadow-violet-900/10"
                : "border-white/10 bg-slate-900/50 text-white shadow-[0_30px_60px_-34px_rgba(139,92,246,0.58)]",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.layout.menuLabel}
            </p>
            {renderNavigation()}
          </aside>
          <main className="min-w-0 flex-1">
            <div key={pathname} className="grid gap-8 route-transition">
              {children}
            </div>
          </main>
        </div>
      </div>
      <div
        className={clsx(
          "fixed inset-0 z-50 transition-opacity duration-200 lg:hidden",
          isMobileNavOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden={!isMobileNavOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          onClick={() => setIsMobileNavOpen(false)}
          aria-label={t.layout.mobileMenu.close}
        />
        <aside
          id="mobile-navigation"
          ref={mobileNavPanelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t.layout.mobileMenu.label}
          tabIndex={-1}
          className={clsx(
            "absolute inset-y-0 left-0 w-[82vw] max-w-[320px] overflow-y-auto border-r px-5 py-5 shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out",
            isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
            isLight
              ? "border-violet-200/90 bg-white/95 text-foreground"
              : "border-white/10 bg-slate-950/95 text-white",
          )}
        >
          <div className="mb-5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t.layout.mobileMenu.label}
            </p>
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className={clsx(
                "inline-flex size-9 items-center justify-center rounded-full border transition cursor-pointer",
                controlStyles,
              )}
              aria-label={t.layout.mobileMenu.close}
            >
              <X className="size-4" />
            </button>
          </div>
          {renderNavigation(true)}
        </aside>
      </div>
    </div>
  );
}
