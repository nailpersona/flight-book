'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { getBreaksDataFromSupabase } from '../../../lib/supabaseData';
import s from '../../../components/shared.module.css';

const MU_TYPES = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];
const COLOR_MAP = { green: '#10B981', yellow: '#F59E0B', red: '#EF4444', gray: '#9CA3AF' };

export default function BreaksMUPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [muData, setMuData] = useState(null);

  useEffect(() => {
    if (!auth?.pib) return;
    (async () => {
      setLoading(true);
      const res = await getBreaksDataFromSupabase(auth.pib);
      if (res.ok) setMuData(res.data.mu);
      setLoading(false);
    })();
  }, [auth?.pib]);

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Перерви за МУ</span>
      </div>

      {loading && <div className={s.loadingWrap}><div className={s.spinner} style={{borderTopColor:'#111827',width:24,height:24}}/></div>}

      {!loading && muData && MU_TYPES.map(mu => {
        const items = muData[mu] || [];
        if (items.length === 0) return null;
        return (
          <div key={mu} className={s.card} style={{ marginBottom: 12 }}>
            <div className={s.sectionHeader}>
              <span className={s.sectionTitle}>{mu}</span>
            </div>
            <table className={s.table}>
              <thead>
                <tr><th>Тип ПС</th><th>Дата</th><th>Дійсно до</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
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
        );
      })}

      {!loading && muData && MU_TYPES.every(mu => !(muData[mu]?.length)) && (
        <div className={s.loadingWrap}><div className={s.emptyText}>Немає даних</div></div>
      )}
    </div>
  );
}
