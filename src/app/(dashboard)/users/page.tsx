"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UserRole = "user" | "admin";

type UserRecord = {
  id: string;
  name: string;
  role: UserRole;
  createdAt: string;
};

export default function UsersPage() {
  const { t, language } = useLanguage();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserRecord | null>(null);
  const locale = language === "en" ? "en-US" : "zh-CN";
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale]
  );

  const roleOptions = useMemo(
    () => [
      { value: "user", label: t.users.roles.user },
      { value: "admin", label: t.users.roles.admin },
    ],
    [t.users.roles.admin, t.users.roles.user]
  );

  useEffect(() => {
    let cancelled = false;
    const loadCurrentUser = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) return;
        const data: { user?: { id?: string } } = await response.json();
        if (data.user?.id && !cancelled) {
          setCurrentUserId(data.user.id);
        }
      } catch (error) {
        console.error("Failed to load current user", error);
      }
    };
    void loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadUsers = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await fetch("/api/admin/users");
        if (!response.ok) {
          throw new Error(t.users.loadError);
        }
        const data: { users?: UserRecord[] } = await response.json();
        if (!cancelled && Array.isArray(data.users)) {
          setUsers(
            data.users.map((user) => ({
              ...user,
              role: user.role === "admin" ? "admin" : "user",
            }))
          );
        }
      } catch (error) {
        console.error("Failed to load users", error);
        if (!cancelled) {
          setLoadError(t.users.loadError);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [t.users.loadError]);

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setSavingId(userId);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, role }),
      });
      const data: { user?: UserRecord; error?: string } = await response.json();

      if (!response.ok || !data.user) {
        throw new Error(data.error ?? t.users.updateError);
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: data.user?.role ?? role } : user
        )
      );
      setFeedback(t.users.success);
      setTimeout(() => setFeedback(null), 2600);
    } catch (error) {
      console.error("Failed to update user role", error);
      setFeedback(t.users.updateError);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section
      className="relative flex flex-col space-y-6 overflow-hidden rounded-[32px] border border-border bg-card/90 p-8 text-foreground shadow-xl shadow-slate-900/10 backdrop-blur animate-slide-up dark:border-white/10 dark:bg-slate-900/60 dark:text-white dark:shadow-violet-900/20"
      style={{ height: "min(794px, calc(100vh - 220px))" }}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-indigo-400/50 via-violet-400/40 to-transparent" />
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
          {t.users.title}
        </h2>
        <p className="text-base text-muted-foreground">{t.users.subtitle}</p>
      </header>

      <div className="flex-1 space-y-4 overflow-hidden rounded-[28px] border border-border bg-muted/40 p-6 dark:border-white/10 dark:bg-slate-950/60">
        {loadError ? (
          <p className="text-sm text-rose-400">{loadError}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.users.loadError}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] items-center gap-4 rounded-2xl border border-dashed border-border bg-card p-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground dark:border-white/10 dark:bg-slate-950/70">
              <span>{t.users.table.name}</span>
              <span>{t.users.table.role}</span>
              <span>{t.users.table.created}</span>
              <span className="text-left">{t.users.table.actions}</span>
            </div>
            <div className="divide-y divide-border rounded-2xl border border-border bg-card dark:divide-white/5 dark:border-white/10 dark:bg-slate-950/60">
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <div
                    key={user.id}
                    className="grid grid-cols-[1.2fr_1fr_1fr_1fr] items-center gap-4 px-4 py-3 text-sm text-foreground dark:text-white/90"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{user.name}</p>
                      {isSelf && (
                        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                          {t.users.selfNote}
                        </p>
                      )}
                    </div>
                    <div>
                      <Select
                        value={user.role}
                        onValueChange={(value) =>
                          handleRoleChange(user.id, value as UserRole)
                        }
                        disabled={isSelf || savingId === user.id}
                      >
                        <SelectTrigger className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground shadow-inner shadow-slate-900/5 data-[placeholder]:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 dark:border-white/10 dark:bg-slate-900/70 dark:text-white dark:shadow-violet-500/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border border-border bg-card text-foreground shadow-lg dark:border-white/10 dark:bg-slate-950/95 dark:text-white">
                          {roleOptions.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="text-sm text-foreground dark:text-white/90"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {dateFormatter.format(new Date(user.createdAt))}
                    </span>
                    <div className="flex flex-col items-start gap-1">
                      {savingId === user.id && (
                        <span className="text-xs text-muted-foreground">
                          {t.users.saving}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        className="cursor-pointer hover:!bg-destructive/50  dark:hover:!bg-destructive/100"
                        size="sm"
                        disabled={isSelf || savingId === user.id}
                        onClick={() => setPendingDelete(user)}
                      >
                        {t.users.delete}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {feedback && (
              <p className="text-xs font-semibold text-foreground">
                {feedback}
              </p>
            )}
          </div>
        )}
      </div>
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.users.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${t.users.delete} ${pendingDelete.name}?`
                : t.users.delete}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setPendingDelete(null)}
              disabled={savingId === pendingDelete?.id}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingDelete) return;
                setSavingId(pendingDelete.id);
                setFeedback(null);
                try {
                  const response = await fetch(
                    `/api/admin/users/${pendingDelete.id}`,
                    { method: "DELETE" }
                  );
                  if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    throw new Error(
                      (data && data.error) || t.users.deleteError
                    );
                  }
                  setUsers((prev) =>
                    prev.filter((item) => item.id !== pendingDelete.id)
                  );
                  setPendingDelete(null);
                } catch (error) {
                  console.error("Failed to delete user", error);
                  setFeedback(
                    error instanceof Error && error.message
                      ? error.message
                      : t.users.deleteError
                  );
                } finally {
                  setSavingId(null);
                }
              }}
              disabled={savingId === pendingDelete?.id}
            >
              {t.users.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
