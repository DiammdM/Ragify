"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CSSProperties,
  MouseEvent,
  PropsWithChildren,
  useCallback,
  useEffect,
  useLayoutEffect,
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
type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
};

const ROUTE_EXIT_DELAY_MS = 420;
const ROUTE_ENTER_CLEAR_MS = 820;

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
  const [leavingPath, setLeavingPath] = useState<string | null>(null);
  const [enteringPath, setEnteringPath] = useState<string | null>(null);
  const [desktopIndicator, setDesktopIndicator] = useState<{
    x: number;
    width: number;
    visible: boolean;
  }>({
    x: 0,
    width: 0,
    visible: false,
  });
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavPanelRef = useRef<HTMLElement>(null);
  const mobileNavWasOpenRef = useRef(false);
  const desktopNavTrackRef = useRef<HTMLDivElement>(null);
  const desktopNavItemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const navTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animateNextRouteRef = useRef(false);

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
      },
      {
        href: "/chat",
        label: t.nav.chat,
        roles: ["user", "admin"],
      },
      {
        href: "/library",
        label: t.nav.library,
        roles: ["admin"],
      },
      {
        href: "/settings",
        label: t.nav.settings,
        roles: ["admin"],
      },
      {
        href: "/users",
        label: t.nav.users,
        roles: ["admin"],
      },
    ],
    [t],
  );

  const allowedNavItems = useMemo(
    () => navItems.filter((item) => item.roles.includes(userRole)),
    [navItems, userRole],
  );

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
    if (leavingPath !== pathname) {
      return;
    }
    setLeavingPath(null);
  }, [leavingPath, pathname]);

  useEffect(() => {
    if (!animateNextRouteRef.current) {
      return;
    }
    animateNextRouteRef.current = false;
    setEnteringPath(pathname);
    if (routeEnterTimerRef.current) {
      clearTimeout(routeEnterTimerRef.current);
    }
    routeEnterTimerRef.current = setTimeout(() => {
      setEnteringPath((current) => (current === pathname ? null : current));
    }, ROUTE_ENTER_CLEAR_MS);
  }, [pathname]);

  useEffect(
    () => () => {
      if (navTransitionTimerRef.current) {
        clearTimeout(navTransitionTimerRef.current);
      }
      if (routeEnterTimerRef.current) {
        clearTimeout(routeEnterTimerRef.current);
      }
    },
    [],
  );

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
    ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
    : "border-white/15 bg-slate-900/70 text-white/80 hover:border-white/30 hover:bg-slate-800 hover:text-white";

  const setDesktopNavItemRef = useCallback(
    (href: string) => (node: HTMLAnchorElement | null) => {
      desktopNavItemRefs.current[href] = node;
    },
    [],
  );

  const updateDesktopIndicator = useCallback(() => {
    const track = desktopNavTrackRef.current;
    const activeItem = desktopNavItemRefs.current[pathname];
    if (!track || !activeItem) {
      setDesktopIndicator((current) =>
        current.visible ? { ...current, visible: false } : current,
      );
      return;
    }
    const x = activeItem.offsetLeft;
    const width = activeItem.offsetWidth;
    setDesktopIndicator((current) => {
      if (current.x === x && current.width === width && current.visible) {
        return current;
      }
      return { x, width, visible: true };
    });
  }, [pathname]);

  useLayoutEffect(() => {
    updateDesktopIndicator();
  }, [allowedNavItems, language, updateDesktopIndicator]);

  useEffect(() => {
    const handleResize = () => updateDesktopIndicator();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateDesktopIndicator]);

  const handleDesktopNavClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      if (href === pathname) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      setLeavingPath(pathname);
      animateNextRouteRef.current = true;
      if (navTransitionTimerRef.current) {
        clearTimeout(navTransitionTimerRef.current);
      }
      navTransitionTimerRef.current = setTimeout(() => {
        setLeavingPath(null);
        router.push(href);
      }, ROUTE_EXIT_DELAY_MS);
    },
    [pathname, router],
  );

  const navItemStyles = useCallback(
    (isActive: boolean, mobile = false) => {
      if (mobile) {
        return clsx(
          "group inline-flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          isActive
            ? isLight
              ? "border-slate-300 bg-slate-900 text-white"
              : "border-white/20 bg-slate-700 text-white"
            : isLight
              ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              : "border-white/10 bg-slate-900/50 text-white/75 hover:bg-slate-800 hover:text-white",
        );
      }

      return clsx(
        "relative z-[1] inline-flex items-center px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isActive
          ? isLight
            ? "text-slate-900"
            : "text-white"
          : isLight
            ? "text-slate-500 hover:text-slate-800"
            : "text-white/65 hover:text-white",
      );
    },
    [isLight],
  );

  const desktopIndicatorStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translateX(${desktopIndicator.x}px)`,
      width: `${desktopIndicator.width}px`,
    }),
    [desktopIndicator.width, desktopIndicator.x],
  );

  const renderNavigation = useCallback(
    (mobile = false) => (
      <nav
        className={clsx(mobile ? "space-y-2" : "overflow-x-auto")}
        aria-label={t.layout.menuLabel}
      >
        <div
          ref={mobile ? undefined : desktopNavTrackRef}
          className={clsx(
            mobile ? "space-y-2" : "relative flex min-w-max items-center gap-1.5 px-2",
          )}
        >
          {allowedNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                ref={mobile ? undefined : setDesktopNavItemRef(item.href)}
                onClick={
                  mobile
                    ? () => setIsMobileNavOpen(false)
                    : (event) => handleDesktopNavClick(event, item.href)
                }
                aria-current={isActive ? "page" : undefined}
                className={navItemStyles(isActive, mobile)}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
          {!mobile ? (
            <span
              aria-hidden
              className={clsx(
                "nav-active-indicator",
                desktopIndicator.visible ? "opacity-100" : "opacity-0",
                isLight ? "bg-slate-900" : "bg-white",
              )}
              style={desktopIndicatorStyle}
            />
          ) : null}
        </div>
      </nav>
    ),
    [
      allowedNavItems,
      desktopIndicator.visible,
      desktopIndicatorStyle,
      handleDesktopNavClick,
      isLight,
      navItemStyles,
      pathname,
      setDesktopNavItemRef,
      t.layout.menuLabel,
    ],
  );

  const controlButtons = (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={toggleLanguage}
        className={clsx(
          "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-xs font-semibold tracking-wide transition cursor-pointer",
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
          "inline-flex size-9 items-center justify-center rounded-lg transition cursor-pointer",
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
        className="h-9 rounded-lg px-3.5 font-semibold cursor-pointer"
      >
        {isLoggingOut ? t.layout.loggingOut : t.layout.logout}
      </Button>
    </>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors">
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 -z-10 transition-colors",
          isLight
            ? "bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,1))]"
            : "bg-[linear-gradient(180deg,rgba(15,23,42,1),rgba(2,6,23,1))]",
        )}
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="space-y-4">
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <button
                ref={mobileMenuButtonRef}
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className={clsx(
                  "inline-flex size-9 items-center justify-center rounded-lg border transition cursor-pointer md:hidden",
                  controlStyles,
                )}
                aria-expanded={isMobileNavOpen}
                aria-controls="mobile-navigation"
                aria-label={t.layout.mobileMenu.open}
              >
                <Menu className="size-5" />
              </button>
              <div className="min-w-0 space-y-0.5">
                <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                  {t.layout.brand}
                </h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-[11px] sm:tracking-[0.24em]">
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
          <div
            className={clsx(
              "hidden border-b md:block",
              isLight
                ? "border-slate-200"
                : "border-white/15",
            )}
          >
            {renderNavigation()}
          </div>
        </header>
        <main className="min-w-0 flex-1">
          <div
            key={pathname}
            className={clsx(
              "route-shell grid gap-8",
              leavingPath === pathname && "route-exit-ltr",
              leavingPath === pathname && "route-veil-exit-ltr",
              enteringPath === pathname && "route-enter-ltr",
              enteringPath === pathname && "route-veil-enter-ltr",
            )}
          >
            {children}
          </div>
        </main>
      </div>
      <div
        className={clsx(
          "fixed inset-0 z-50 transition-opacity duration-200 md:hidden",
          isMobileNavOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden={!isMobileNavOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/45"
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
            "absolute inset-y-0 left-0 w-[82vw] max-w-[320px] overflow-y-auto border-r px-5 py-5 transition-transform duration-200 ease-out",
            isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
            isLight
              ? "border-slate-200 bg-white text-foreground"
              : "border-white/15 bg-slate-950 text-white",
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
                "inline-flex size-9 items-center justify-center rounded-lg border transition cursor-pointer",
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
