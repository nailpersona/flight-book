'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoLogInOutline, IoEyeOutline, IoEyeOffOutline, IoPersonAddOutline, IoChevronDownOutline } from 'react-icons/io5';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import styles from './page.module.css';

const CREW_ROLES = ['Пілот', 'Штурман', 'Бортовий технік'];

export default function LoginPage() {
  const { setAuth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [crewRole, setCrewRole] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

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
        position: j.position || '',
        canEditReadiness: j.can_edit_readiness || false,
        expires: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
      };
      setAuth(authObj);
      router.replace('/tabs/main');
    } catch (err) {
      window.alert(String(err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const onRegister = async (e) => {
    e.preventDefault();
    console.log('=== REGISTER DEBUG ===');
    console.log('email:', email.trim());
    console.log('name:', name.trim());
    console.log('inviteCode:', inviteCode.trim());
    console.log('crewRole:', crewRole);
    console.log('password length:', pass.trim().length);

    if (!email.trim() || !pass.trim() || !name.trim() || !inviteCode.trim() || !crewRole) {
      window.alert('Заповніть усі поля');
      return;
    }
    try {
      setBusy(true);
      const { data: j, error: rpcErr } = await supabase.rpc('fn_register_with_position_invite', {
        p_email: email.trim(),
        p_password: pass.trim(),
        p_name: name.trim(),
        p_invite_code: inviteCode.trim(),
        p_crew_role: crewRole,
      });

      console.log('RPC response:', j);
      console.log('RPC error:', rpcErr);

      if (rpcErr) throw new Error(rpcErr.message);
      if (!j?.ok) throw new Error(j?.error || 'Помилка реєстрації');

      const authObj = {
        userId: j.id,
        role: j.role || 'user',
        pib: j.pib || '',
        email: j.email || email.trim(),
        position: j.position || '',
        canEditReadiness: j.can_edit_readiness || false,
        expires: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
      };
      setAuth(authObj);
      router.replace('/tabs/main');
    } catch (err) {
      window.alert(String(err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    if (isRegister) {
      onRegister(e);
    } else {
      onLogin(e);
    }
  };

  return (
    <div className={styles.safe}>
      <form className={styles.scroll} onSubmit={handleSubmit}>
        <div className={styles.logoWrap}>
          <img src="/logo.png" alt="Fly Book" className={styles.logo} />
        </div>

        <div className={styles.card}>
          {/* Mode switch */}
          <div className={styles.modeSwitch}>
            <button
              type="button"
              className={`${styles.modeBtn} ${!isRegister ? styles.modeBtnActive : ''}`}
              onClick={() => setIsRegister(false)}
            >
              Вхід
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${isRegister ? styles.modeBtnActive : ''}`}
              onClick={() => setIsRegister(true)}
            >
              Реєстрація
            </button>
          </div>

          <div className={styles.subtitle}>
            {isRegister ? 'Реєстрація з кодом запрошення' : 'Авторизуйтесь для продовження'}
          </div>

          {/* Email */}
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

          {/* Password */}
          <div className={styles.label}>Пароль</div>
          <div className={`${styles.inputWrap} ${focused === 'pass' ? styles.inputFocused : ''}`}>
            <input
              className={styles.input}
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={isRegister ? 'Придумайте пароль' : 'Введіть пароль'}
              onFocus={() => setFocused('pass')}
              onBlur={() => setFocused(null)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPass((s) => !s)}
            >
              {showPass ? <IoEyeOffOutline size={20} /> : <IoEyeOutline size={20} />}
            </button>
          </div>

          {/* Registration-only fields */}
          {isRegister && (
            <>
              {/* ПІБ */}
              <div className={styles.label}>Звання та ПІБ</div>
              <div className={`${styles.inputWrap} ${focused === 'name' ? styles.inputFocused : ''}`}>
                <input
                  className={styles.input}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="п-к Пілот П.П."
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                  autoComplete="name"
                />
              </div>

              {/* Роль в екіпажі */}
              <div className={styles.label}>Роль в екіпажі</div>
              <button
                type="button"
                className={styles.roleSelect}
                onClick={() => setShowRoleModal(true)}
              >
                <span className={`${styles.roleSelectText} ${!crewRole ? styles.roleSelectPlaceholder : ''}`}>
                  {crewRole || 'Оберіть роль'}
                </span>
                <IoChevronDownOutline size={16} color="#9CA3AF" />
              </button>

              {/* Код від командира */}
              <div className={styles.label}>Код від адміна</div>
              <div className={`${styles.inputWrap} ${focused === 'invite' ? styles.inputFocused : ''}`}>
                <input
                  className={styles.input}
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Введіть код від адміна"
                  onFocus={() => setFocused('invite')}
                  onBlur={() => setFocused(null)}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </>
          )}

          <button type="submit" className={styles.btn} disabled={busy}>
            {busy ? <div className={styles.spinner} /> : (
              <>
                <span className={styles.btnIcon}>
                  {isRegister ? <IoPersonAddOutline size={18} /> : <IoLogInOutline size={18} />}
                </span>
                <span className={styles.btnText}>{isRegister ? 'Зареєструватися' : 'Увійти'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Role selection modal */}
      {showRoleModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowRoleModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Роль в екіпажі</div>
            <div className={styles.roleList}>
              {CREW_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`${styles.optionRow} ${crewRole === role ? styles.optionRowSelected : ''}`}
                  onClick={() => { setCrewRole(role); setShowRoleModal(false); }}
                >
                  <span className={`${styles.optionText} ${crewRole === role ? styles.optionTextSelected : ''}`}>
                    {role}
                  </span>
                  {crewRole === role && <span className={styles.selectedMark}>✓</span>}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setShowRoleModal(false)}
            >
              Закрити
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
