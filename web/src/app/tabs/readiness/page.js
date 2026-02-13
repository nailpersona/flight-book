'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoPrintOutline, IoBarChart } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { getAllPilotsReadinessData } from '../../../lib/supabaseData';
import s from './readiness.module.css';

const MU_TYPES_LIST = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];
const COMM_TYPES_LIST = ['Авар.зал.', 'Ст.205', 'ЛЛК', 'УМО', 'Відпустка', 'Стрибки'];
const ANNUAL_TYPES_LIST = ['Техніка пілотування', 'ТП за дублями', 'Навігація', 'Бойове застосування', 'Інструкторська', 'Методика ЛВ', 'Захід за приладами', 'ТП з ІВД'];
const LP_BREAK_TYPES_LIST = [
  'Польоти на Нмал',
  'Польоти на СП',
  'Повітр. бій з ударними',
  'Повітр. бій з винищ.',
  'Польоти на ГМВ (з ОНБ)',
  'Польоти парою',
  'Польоти на БЗ',
  'БЗ по НЦ з ПВМ',
  'БЗ по НЦ з СВМ',
  'ПБ за нешвидк. ПЦ',
  'Десантування',
  'Продовж. зліт/посадка',
  'Пошуково-рятувальні',
  'Зовнішня підвіска/евак.',
];

// Status colors (soft pastel)
const STATUS = {
  green: { bg: '#E8F5E9', text: '#2E7D32' },
  yellow: { bg: '#FFF8E1', text: '#F57F17' },
  red: { bg: '#FFEBEE', text: '#C62828' },
  gray: { bg: '#F3F4F6', text: '#6B7280' },
};

const getStatus = (color) => STATUS[color] || STATUS.gray;

export default function ReadinessPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    const result = await getAllPilotsReadinessData();
    if (result.ok) {
      setData(result.data);
    }
    setLoading(false);
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className={s.loading}>
        <div className={s.spinner}></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={s.loading}>
        <div>Помилка завантаження даних</div>
      </div>
    );
  }

  return (
    <div className={s.container}>
      {/* Header */}
      <div className={s.header}>
        <button className={s.backBtn} onClick={() => router.push('/tabs/profile')}>
          <IoChevronBack size={20} />
        </button>
        <div className={s.titleBlock}>
          <div className={s.title}>Стан бойової готовності</div>
        </div>
        <div className={s.actions}>
          <button className={s.actionBtn} onClick={() => router.push('/tabs/summary-all')}>
            <IoBarChart size={16} />
            Підсумки
          </button>
          <button className={s.actionBtn} onClick={handlePrint}>
            <IoPrintOutline size={16} />
            Друк
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className={s.summaryRow}>
        <SummaryCard value={data.summary.total} label="Всього пілотів" variant="total" />
        <SummaryCard value={data.summary.green} label="Готові" variant="green" />
        <SummaryCard value={data.summary.yellow} label="Попередження" variant="yellow" />
        <SummaryCard value={data.summary.red} label="Не готові" variant="red" />
      </div>

      {/* Pilots table (Excel style with date cells) */}
      <table className={s.table}>
        <thead>
          {/* Group header row */}
          <tr className={s.tableHeader}>
            <th colSpan={5} className={s.thGroup}>Загальні дані</th>
            <th colSpan={6} className={s.thGroup}>Час доби та МУ</th>
            <th colSpan={6} className={s.thGroup}>Таблиця комісування</th>
            <th colSpan={9} className={s.thGroup}>Річні перевірки</th>
            <th colSpan={14} className={s.thGroup}>Перерви за видами ЛП</th>
          </tr>
          {/* Column header row */}
          <tr className={s.tableHeader}>
            <th className={s.thNum}>№</th>
            <th className={s.thName}>Пілот</th>
            <th className={s.thClass}>Клас</th>
            <th className={s.thPresent}>Наявність</th>
            <th className={s.thAircraft}>Тип ПС</th>
            {MU_TYPES_LIST.map(t => <th key={t} className={s.thMu}>{t}</th>)}
            {COMM_TYPES_LIST.map(t => <th key={t} className={s.thComm}>{t}</th>)}
            {ANNUAL_TYPES_LIST.map(t => <th key={t} className={s.thAnnual}>{t}</th>)}
            {LP_BREAK_TYPES_LIST.map(t => <th key={t} className={s.thLpBreak}>{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.pilots.map((pilot, pilotIdx) => {
            const rowNum = pilotIdx + 1;
            const aircraftCount = pilot.aircraft.length || 1;
            const pilotRowSpan = aircraftCount;

            if (pilot.aircraft.length === 0) {
              // Pilot with no aircraft - single empty row
              return (
                <tr key={pilot.id} className={s.pilotRow}>
                  <td className={s.tdNum}>{rowNum}</td>
                  <td className={s.tdName}>
                    <div className={s.pilotName}>{pilot.name}</div>
                    <div className={s.pilotInfo}>{pilot.position || ''}</div>
                  </td>
                  <td className={s.tdClass}>{pilot.militaryClass}</td>
                  <td className={s.tdPresent}>✓</td>
                  <td className={s.tdAircraft}>—</td>
                  {MU_TYPES_LIST.map(t => <DateCellTd key={t} date="" color="gray" />)}
                  {COMM_TYPES_LIST.map(t => <DateCellTd key={t} date="" color="gray" />)}
                  {ANNUAL_TYPES_LIST.map(t => <DateCellTd key={t} date="" color="gray" />)}
                  {LP_BREAK_TYPES_LIST.map(t => <DateCellTd key={t} date="" color="gray" />)}
                </tr>
              );
            }

            // Pilot with aircraft - first row has pilot info with rowspan
            return (
              <React.Fragment key={pilot.id}>
                {pilot.aircraft.map((ac, acIdx) => (
                  <tr key={`${pilot.id}-${ac.name}`} className={s.aircraftRow}>
                    {/* First aircraft row has pilot info with rowspan */}
                    {acIdx === 0 ? (
                      <>
                        <td rowSpan={pilotRowSpan} className={s.tdNum}>{rowNum}</td>
                        <td rowSpan={pilotRowSpan} className={s.tdName}>
                          <div className={s.pilotName}>{pilot.name}</div>
                          <div className={s.pilotInfo}>{pilot.position || ''}</div>
                        </td>
                        <td rowSpan={pilotRowSpan} className={s.tdClass}>{pilot.militaryClass}</td>
                      </>
                    ) : null}

                    {/* Availability and Aircraft name */}
                    <td className={s.tdPresent}>✓</td>
                    <td className={s.tdAircraft}>{ac.name}</td>

                    {/* MU dates */}
                    {MU_TYPES_LIST.map(muType => {
                      const item = ac.mu?.[muType];
                      return <DateCellTd key={muType} date={item?.date} color={item?.color} />;
                    })}

                    {/* Commission dates */}
                    {COMM_TYPES_LIST.map(commType => {
                      const item = ac.comm?.[commType];
                      return <DateCellTd key={commType} date={item?.date} color={item?.color} />;
                    })}

                    {/* Annual check dates */}
                    {ANNUAL_TYPES_LIST.map(annType => {
                      const item = ac.annual?.[annType];
                      return <DateCellTd key={annType} date={item?.date} color={item?.color} />;
                    })}

                    {/* LP Break dates */}
                    {LP_BREAK_TYPES_LIST.map(lpBreakType => {
                      const item = ac.lpBreak?.[lpBreakType];
                      return <DateCellTd key={lpBreakType} date={item?.date} color={item?.color} />;
                    })}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ value, label, variant }) {
  const variantClass = variant === 'total' ? s.summaryTotal :
                      variant === 'green' ? s.summaryGreen :
                      variant === 'yellow' ? s.summaryYellow : s.summaryRed;
  return (
    <div className={`${s.summaryCard} ${variantClass}`}>
      <div className={s.summaryValue}>{value}</div>
      <div className={s.summaryLabel}>{label}</div>
    </div>
  );
}

function DateCell({ date, color }) {
  const st = getStatus(color);
  return (
    <div className={s.dateCell} style={{ backgroundColor: st.bg }}>
      <span style={{ color: st.text }}>{date || '—'}</span>
    </div>
  );
}

function DateCellTd({ date, color }) {
  const st = getStatus(color);
  return (
    <td className={s.dateCell} style={{ backgroundColor: st.bg }}>
      <span style={{ color: st.text }}>{date || '—'}</span>
    </td>
  );
}
