'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
      <div className="bg-bg-primary rounded-xl p-8 shadow-sm border border-border w-full max-w-sm">
        <h1 className="text-xl text-text-primary mb-6 text-center">
          Льотна книжка
        </h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-text-primary mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-border bg-bg-primary text-text-primary text-base outline-none focus:border-accent"
              required
            />
          </div>

          <div>
            <label className="text-sm text-text-primary mb-1 block">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-border bg-bg-primary text-text-primary text-base outline-none focus:border-accent"
              required
            />
          </div>

          {error && (
            <p className="text-error text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl bg-primary text-white text-base cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Вхід...' : 'Увійти'}
          </button>
        </form>
      </div>
    </div>
  );
}
