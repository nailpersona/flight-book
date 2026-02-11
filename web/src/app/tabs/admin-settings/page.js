'use client';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoPeopleOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import s from '../../../components/shared.module.css';

export default function AdminSettingsPage() {
  const { auth } = useAuth();
  const router = useRouter();

  if (auth?.role !== 'admin') {
    return <div className={s.page}><div className={s.emptyText}>Доступ заборонено</div></div>;
  }

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Адмін</span>
      </div>

      <button className={s.menuBtn} style={{ width: '100%' }} onClick={() => router.push('/tabs/admin-users')}>
        <span className={s.menuBtnIcon}><IoPeopleOutline size={18} /></span>
        Користувачі
      </button>
    </div>
  );
}
