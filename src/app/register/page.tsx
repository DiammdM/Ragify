'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
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
      const response = await fetch('/api/auth/register', {
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
      console.error('Registration failed', err);
      setError(t.auth.errors.generic);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 rounded-[32px] border border-border bg-card/90 p-8 shadow-xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-violet-900/20">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
          {t.auth.register.title}
        </h2>
        <p className="text-base text-muted-foreground">{t.auth.register.subtitle}</p>
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
            variant="cta-success"
            size="pill"
            className="w-fit font-semibold"
          >
            {isSubmitting ? t.auth.form.submitting : t.auth.register.submit}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t.auth.register.switchPrompt}{' '}
            <Link
              href="/login"
              className="font-semibold text-primary hover:text-primary/80"
            >
              {t.auth.register.switchCta}
            </Link>
          </p>
        </div>
      </form>
    </section>
  );
}
