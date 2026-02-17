'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { getBreaksDataFromSupabase } from '../../../lib/supabaseData';
import s from '../../../components/shared.module.css';

// Soft status colors — matching mobile
const STATUS = {
  green: { bg: '#E8F5E9', text: '#2E7D32', dot: '#4CAF50' },
  yellow: { bg: '#FFF8E1', text: '#F57F17', dot: '#FFC107' },
  red: { bg: '#FFEBEE', text: '#C62828', dot: '#EF5350' },
  gray: { bg: '#F3F4F6', text: '#6B7280', dot: '#D1D5DB' },
};

const getStatus = (color) => STATUS[color] || STATUS.gray;

function DateBox({ date, color }) {
  const st = getStatus(color);
  return (
    <div className={s.dateBox} style={{ backgroundColor: st.bg }}>
      <span style={{ color: st.text }}>{date || '—'}</span>
    </div>
  );
}

// Simple commission categories (single-row or multi-row)
const SIMPLE_CATEGORIES = [
  'Аварійне залишення',
  'Ст. 205 ПРІАЗ',
  'Відпустка',
  'Стрибки з парашутом',
];

const MULTI_ROW = new Set(['Ст. 205 ПРІАЗ']);

function SimpleSection({ cat, items, onRender }) {
  const isMulti = MULTI_ROW.has(cat);

  return (
    <div className={s.breaksSection}>
      <div className={s.breaksSectionHeader}>
        <span className={s.breaksSectionTitle}>{cat}</span>
      </div>

      {isMulti ? (
        items.length > 0 ? items.map((item, idx) => {
          const st = getStatus(item.color);
          const isLast = idx === items.length - 1;
          return (
            <div key={idx} className={`${s.breaksRow} ${isLast ? s.breaksRowLast : ''}`}>
              <div className={s.breaksRowLeft}>
                <div className={s.statusDot} style={{ backgroundColor: st.dot }} />
                <span className={s.breaksAircraftText}>{item.aircraft || '—'}</span>
              </div>
              <div className={s.breaksRowRight}>
                <DateBox date={item.date} color={item.color} />
                <DateBox date={item.expiryDate} color={item.color} />
              </div>
            </div>
          );
        }) : (
          <div className={s.breaksEmptyText}>Немає даних</div>
        )
      ) : (
        (() => {
          const item = items.length > 0 ? items[0] : null;
          const st = getStatus(item?.color);
          return (
            <div className={`${s.breaksRow} ${s.breaksRowLast}`}>
              <div className={s.breaksRowLeft}>
                <div className={s.statusDot} style={{ backgroundColor: st.dot }} />
              </div>
              <div className={s.breaksRowRight}>
                <DateBox date={item?.date} color={item?.color} />
                <DateBox date={item?.expiryDate} color={item?.color} />
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}

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
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}>
          <IoChevronBack size={20} />
        </button>
        <span className={s.topBarTitle}>Таблиця комісування</span>
      </div>

      {loading && (
        <div className={s.loadingWrap}>
          <div className={s.spinner} style={{ borderTopColor: '#111827', width: 24, height: 24 }} />
        </div>
      )}

      {!loading && commission && (
        <>
          {/* Column headers */}
          <div className={s.breaksColumnHeaders}>
            <span className={s.breaksColHeaderLeft}></span>
            <span className={s.breaksColHeaderCenter}>Дата</span>
            <span className={s.breaksColHeaderRight}>Дійсний до</span>
          </div>

          {/* Simple categories before ЛЛК/УМО */}
          {['Аварійне залишення', 'Ст. 205 ПРІАЗ'].map((cat) => {
            const items = commission[cat] || [];
            if (items.length === 0) return null;
            return <SimpleSection key={cat} cat={cat} items={items} />;
          })}

          {/* ЛЛК / УМО — special block */}
          {commission['ЛЛК/УМО'] && (
            <div className={s.breaksSection}>
              {/* Section header with ЛЛК / ПМО labels */}
              <div className={s.llkUmoSectionHeader}>
                <div style={{ flex: 1 }} />
                <div className={s.llkUmoLabelGroup}>
                  <span className={s.llkUmoHeaderLabel}>ЛЛК</span>
                  <div style={{ width: 28 }} />
                </div>
                <div className={s.llkUmoLabelGroup}>
                  <span className={s.llkUmoHeaderLabel}>ПМО</span>
                  <div style={{ width: 28 }} />
                </div>
              </div>

              {/* Dates row */}
              <div className={s.llkUmoRow}>
                <div className={s.breaksRowLeft}>
                  <div
                    className={s.statusDot}
                    style={{
                      backgroundColor: (commission['ЛЛК/УМО'].llk || commission['ЛЛК/УМО'].umo)
                        ? getStatus(commission['ЛЛК/УМО'].nextColor).dot
                        : STATUS.gray.dot
                    }}
                  />
                </div>
                <div className={s.llkUmoDates}>
                  {/* ЛЛК date */}
                  <div className={s.llkUmoDateItem}>
                    <DateBox
                      date={commission['ЛЛК/УМО'].llk?.date}
                      color={commission['ЛЛК/УМО'].llk?.color}
                    />
                  </div>

                  {/* УМО date */}
                  <div className={s.llkUmoDateItem}>
                    <DateBox
                      date={commission['ЛЛК/УМО'].umo?.date}
                      color={commission['ЛЛК/УМО'].umo?.color}
                    />
                  </div>
                </div>
              </div>

              {/* Next due line */}
              {commission['ЛЛК/УМО'].nextType && (
                <div className={s.nextDueText}>
                  Наступне {commission['ЛЛК/УМО'].nextType}: {commission['ЛЛК/УМО'].nextDate}
                </div>
              )}
            </div>
          )}

          {/* Simple categories after ЛЛК/УМО */}
          {['Відпустка', 'Стрибки з парашутом'].map((cat) => {
            const items = commission[cat] || [];
            if (items.length === 0) return null;
            return <SimpleSection key={cat} cat={cat} items={items} />;
          })}
        </>
      )}

      {!loading && !commission && (
        <div className={s.loadingWrap}>
          <div className={s.breaksEmptyText}>Немає даних</div>
        </div>
      )}
    </div>
  );
}
