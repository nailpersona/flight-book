'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { getBreaksDataFromSupabase } from '../../../lib/supabaseData';
import s from '../../../components/shared.module.css';

const COLOR_MAP = { green: '#10B981', yellow: '#F59E0B', red: '#EF4444', gray: '#9CA3AF' };

export default function CommissionPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [commission, setCommission] = useState(null);

  useEffect(() => {
    if (!auth?.pib) return;
    (async () => {
      setLoading(true);
      const res = await getBreaksDataFromSupabase(auth.pib);
      if (res.ok) setCommission(res.data.commission);
      setLoading(false);
    })();
  }, [auth?.pib]);

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Таблиця комісування</span>
      </div>

      {loading && <div className={s.loadingWrap}><div className={s.spinner} style={{borderTopColor:'#111827',width:24,height:24}}/></div>}

      {!loading && commission && (
        <>
          {/* ЛЛК/УМО */}
          {commission['ЛЛК/УМО'] && (
            <div className={s.card} style={{ marginBottom: 12 }}>
              <div className={s.sectionHeader}><span className={s.sectionTitle}>ЛЛК / ПМО</span></div>
              <table className={s.table}>
                <tbody>
                  {commission['ЛЛК/УМО'].llk && (
                    <tr>
                      <td>ЛЛК</td>
                      <td>{commission['ЛЛК/УМО'].llk.date}</td>
                      <td><span className={s.statusDot} style={{background: COLOR_MAP[commission['ЛЛК/УМО'].llk.color]}} /></td>
                    </tr>
                  )}
                  {commission['ЛЛК/УМО'].umo && (
                    <tr>
                      <td>ПМО</td>
                      <td>{commission['ЛЛК/УМО'].umo.date}</td>
                      <td><span className={s.statusDot} style={{background: COLOR_MAP[commission['ЛЛК/УМО'].umo.color]}} /></td>
                    </tr>
                  )}
                  {commission['ЛЛК/УМО'].nextType && (
                    <tr>
                      <td>Наступне: {commission['ЛЛК/УМО'].nextType}</td>
                      <td>{commission['ЛЛК/УМО'].nextDate}</td>
                      <td><span className={s.statusDot} style={{background: COLOR_MAP[commission['ЛЛК/УМО'].nextColor]}} /></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Ст. 205 ПРІАЗ */}
          {commission['Ст. 205 ПРІАЗ'] && commission['Ст. 205 ПРІАЗ'].length > 0 && (
            <div className={s.card} style={{ marginBottom: 12 }}>
              <div className={s.sectionHeader}><span className={s.sectionTitle}>Ст. 205 ПРІАЗ</span></div>
              <table className={s.table}>
                <thead><tr><th>Тип ПС</th><th>Дата</th><th>Дійсно до</th><th></th></tr></thead>
                <tbody>
                  {commission['Ст. 205 ПРІАЗ'].map((item, i) => (
                    <tr key={i}>
                      <td>{item.aircraft}</td>
                      <td>{item.date || '—'}</td>
                      <td>{item.expiryDate || '—'}</td>
                      <td><span className={s.statusDot} style={{background: COLOR_MAP[item.color]}} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Other commission types */}
          {['Аварійне залишення', 'Відпустка', 'Стрибки з парашутом'].map(typeName => {
            const items = commission[typeName] || [];
            if (items.length === 0) return null;
            return (
              <div key={typeName} className={s.card} style={{ marginBottom: 12 }}>
                <div className={s.sectionHeader}><span className={s.sectionTitle}>{typeName}</span></div>
                <table className={s.table}>
                  <thead><tr><th>Дата</th><th>Дійсно до</th><th></th></tr></thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.date || '—'}</td>
                        <td>{item.expiryDate || '—'}</td>
                        <td><span className={s.statusDot} style={{background: COLOR_MAP[item.color]}} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}

      {!loading && !commission && <div className={s.loadingWrap}><div className={s.emptyText}>Немає даних</div></div>}
    </div>
  );
}
