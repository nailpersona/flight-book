'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoLogInOutline, IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import styles from './page.module.css';

export default function LoginPage() {
  const { setAuth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(null);

  const onLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !pass.trim()) {
      window.alert('Введіть email і пароль');
      return;
    }
    try {
      setBusy(true);
      const { data: j, error: rpcErr } = await supabase.rpc('fn_login', {
        p_email: email.trim(),
        p_password: pass.trim(),
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!j?.ok) throw new Error(j?.error || 'Помилка входу');

      const WEEK = 7 * 24 * 60 * 60 * 1000;
      const authObj = {
        userId: j.id,
        role: j.role || 'user',
        pib: j.pib || '',
        email: j.email || email.trim(),
        expires: Date.now() + WEEK,
      };
      setAuth(authObj);
      router.replace('/tabs/main');
    } catch (err) {
      window.alert(String(err.message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.safe}>
      <form className={styles.scroll} onSubmit={onLogin}>
        <div className={styles.logoWrap}>
          <img src="/logo.png" alt="Fly Book" className={styles.logo} />
        </div>

        <div className={styles.card}>
          <div className={styles.title}>Вхід</div>
          <div className={styles.subtitle}>Авторизуйтесь для продовження</div>

          <div className={styles.label}>Email</div>
          <div className={`${styles.inputWrap} ${focused === 'email' ? styles.inputFocused : ''}`}>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              autoComplete="email"
            />
          </div>

          <div className={styles.label}>Пароль</div>
          <div className={`${styles.inputWrap} ${focused === 'pass' ? styles.inputFocused : ''}`}>
            <input
              className={styles.input}
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Введіть пароль"
              onFocus={() => setFocused('pass')}
              onBlur={() => setFocused(null)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPass((s) => !s)}
            >
              {showPass ? <IoEyeOffOutline size={20} /> : <IoEyeOutline size={20} />}
            </button>
          </div>

          <button type="submit" className={styles.btn} disabled={busy}>
            {busy ? <div className={styles.spinner} /> : (
              <>
                <span className={styles.btnIcon}><IoLogInOutline size={18} /></span>
                <span className={styles.btnText}>Увійти</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
