'use client';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoPeopleOutline, IoTreeOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import s from '../../../components/shared.module.css';

export default function AdminSettingsPage() {
  const { auth } = useAuth();
  const router = useRouter();

  if (auth?.role !== 'admin') {
    return <div className={s.page}><div className={s.emptyText}>Доступ заборонено</div></div>;
  }

  return (
    <div className={s.page} style={{ paddingTop: 20 }}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Адмін</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <button className={s.menuBtn} style={{ width: '80%', justifyContent: 'center', background: '#D9DBDE', borderColor: '#B0B3B8', color: '#555860' }} onClick={() => router.push('/tabs/admin-units')}>
          <span className={s.menuBtnIcon} style={{ color: '#555860' }}><IoTreeOutline size={18} /></span>
          Посади
        </button>

        <button className={s.menuBtn} style={{ width: '80%', justifyContent: 'center', background: '#D9DBDE', borderColor: '#B0B3B8', color: '#555860' }} onClick={() => router.push('/tabs/admin-users')}>
          <span className={s.menuBtnIcon} style={{ color: '#555860' }}><IoPeopleOutline size={18} /></span>
          Користувачі
        </button>
      </div>
    </div>
  );
}
