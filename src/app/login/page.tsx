'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/language-provider';

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
    <section className="mx-auto w-full max-w-2xl space-y-6 rounded-[32px] border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-violet-900/20 backdrop-blur">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">{t.auth.login.title}</h2>
        <p className="text-base text-slate-200/80">{t.auth.login.subtitle}</p>
      </header>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm text-slate-200/90">
          <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
            {t.auth.form.nameLabel}
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.auth.form.namePlaceholder}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-violet-500/20 outline-none transition focus:border-violet-300/70 focus:shadow-violet-500/30"
          />
        </label>

        <label className="block space-y-2 text-sm text-slate-200/90">
          <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/80">
            {t.auth.form.passwordLabel}
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t.auth.form.passwordPlaceholder}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-violet-500/20 outline-none transition focus:border-violet-300/70 focus:shadow-violet-500/30"
          />
        </label>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-fit items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-violet-500/40 transition hover:brightness-110 disabled:opacity-70"
          >
            {isSubmitting ? t.auth.form.submitting : t.auth.login.submit}
          </button>
          <p className="text-xs text-slate-300/80">
            {t.auth.login.switchPrompt}{' '}
            <Link href="/register" className="font-semibold text-violet-200 hover:text-white">
              {t.auth.login.switchCta}
            </Link>
          </p>
        </div>
      </form>
    </section>
  );
}
