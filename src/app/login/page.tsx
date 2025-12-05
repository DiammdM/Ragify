'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, password }),
      });

      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setError(data.error ?? t.auth.errors.generic);
        return;
      }

      router.push('/');
    } catch (err) {
      console.error('Login failed', err);
      setError(t.auth.errors.generic);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4 py-10">
      <div className="relative w-full space-y-6 rounded-[32px] border border-border bg-card/90 p-8 shadow-xl shadow-slate-900/10 backdrop-blur animate-slide-up dark:border-white/10 dark:bg-slate-900/60 dark:shadow-violet-900/20">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-violet-400/40 via-indigo-300/35 to-transparent" />
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {t.auth.login.title}
          </h2>
          <p className="text-base text-muted-foreground">
            {t.auth.login.subtitle}
          </p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {t.auth.form.nameLabel}
            </span>
            <Input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.auth.form.namePlaceholder}
            />
          </label>

          <label className="block space-y-2 text-sm text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {t.auth.form.passwordLabel}
            </span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t.auth.form.passwordPlaceholder}
            />
          </label>

          {error && <p className="text-sm text-rose-300">{error}</p>}

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="cta"
              size="pill"
              className="w-fit font-semibold"
            >
              {isSubmitting ? t.auth.form.submitting : t.auth.login.submit}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t.auth.login.switchPrompt}{' '}
              <Link
                href="/register"
                className="font-semibold text-primary hover:text-primary/80"
              >
                {t.auth.login.switchCta}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
