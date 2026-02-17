'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoPeopleOutline, IoGitNetworkOutline, IoNotificationsOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import s from '../../../components/shared.module.css';

export default function AdminSettingsPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  if (auth?.role !== 'admin') {
    return <div className={s.page}><div className={s.emptyText}>Доступ заборонено</div></div>;
  }

  const runDeadlineCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch('/api/check-deadlines', { method: 'POST' });
      const data = await res.json();
      setCheckResult(data);
    } catch (err) {
      setCheckResult({ error: err.message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={s.page} style={{ paddingTop: 20 }}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Адмін</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <button className={s.menuBtn} style={{ width: '80%', justifyContent: 'center', background: '#D9DBDE', borderColor: '#B0B3B8', color: '#555860' }} onClick={() => router.push('/tabs/admin-positions')}>
          <span className={s.menuBtnIcon} style={{ color: '#555860' }}><IoGitNetworkOutline size={18} /></span>
          Посади
        </button>

        <button className={s.menuBtn} style={{ width: '80%', justifyContent: 'center', background: '#D9DBDE', borderColor: '#B0B3B8', color: '#555860' }} onClick={() => router.push('/tabs/admin-users')}>
          <span className={s.menuBtnIcon} style={{ color: '#555860' }}><IoPeopleOutline size={18} /></span>
          Користувачі
        </button>

        <button
          className={s.menuBtn}
          style={{ width: '80%', justifyContent: 'center', background: checking ? '#E5E7EB' : '#3B82F6', borderColor: '#3B82F6', color: '#FFFFFF' }}
          onClick={runDeadlineCheck}
          disabled={checking}
        >
          <span className={s.menuBtnIcon} style={{ color: '#FFFFFF' }}><IoNotificationsOutline size={18} /></span>
          {checking ? 'Перевірка...' : 'Перевірити терміни'}
        </button>

        {checkResult && (
          <div style={{
            width: '80%',
            padding: 12,
            borderRadius: 12,
            background: checkResult.error ? '#FEF2F2' : '#F0FDF4',
            fontSize: 13,
            color: checkResult.error ? '#DC2626' : '#166534'
          }}>
            {checkResult.error ? (
              <>Помилка: {checkResult.error}</>
            ) : (
              <>Створено {checkResult.notifications?.new || 0} повідомлень</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
