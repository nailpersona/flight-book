'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { getBreaksDataFromSupabase } from '../../../lib/supabaseData';
import s from '../../../components/shared.module.css';

const COLOR_MAP = { green: '#10B981', yellow: '#F59E0B', red: '#EF4444', gray: '#9CA3AF' };

export default function BreaksLPPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lpSections, setLpSections] = useState([]);

  useEffect(() => {
    if (!auth?.pib) return;
    (async () => {
      setLoading(true);
      const res = await getBreaksDataFromSupabase(auth.pib);
      if (res.ok) setLpSections(res.data.lpSections || []);
      setLoading(false);
    })();
  }, [auth?.pib]);

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Перерви за видами ЛП</span>
      </div>

      {loading && <div className={s.loadingWrap}><div className={s.spinner} style={{borderTopColor:'#111827',width:24,height:24}}/></div>}

      {!loading && lpSections.map((section, idx) => (
        <div key={idx} className={s.card} style={{ marginBottom: 12 }}>
          <div className={s.sectionHeader}>
            <span className={s.sectionTitle}>{section.name}</span>
          </div>
          <table className={s.table}>
            <thead>
              <tr><th>Тип ПС</th><th>Дата</th><th>Дійсно до</th><th></th></tr>
            </thead>
            <tbody>
              {section.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.aircraft}</td>
                  <td>{item.date || '—'}</td>
                  <td>{item.expiryDate || '—'}</td>
                  <td><span className={s.statusDot} style={{background: COLOR_MAP[item.color] || COLOR_MAP.gray}} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {!loading && lpSections.length === 0 && (
        <div className={s.loadingWrap}><div className={s.emptyText}>Немає даних</div></div>
      )}
    </div>
  );
}
