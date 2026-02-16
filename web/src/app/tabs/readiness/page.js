'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoPrintOutline, IoBarChart, IoClose } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import {
  getAllPilotsReadinessData,
  updateMuBreakDateInSupabase,
  updateLpBreakDateById,
  updateAnnualCheckDateById,
  updateCommissionDateById,
  deleteMuBreakDateById,
  deleteLpBreakDateById,
  deleteAnnualCheckDateById,
  deleteCommissionDateById,
} from '../../../lib/supabaseData';
import s from './readiness.module.css';

const MU_TYPES_LIST = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];
const COMM_TYPES_LIST = ['Аварійне залишення', 'Ст. 205 ПРІАЗ', 'ЛЛК', 'УМО', 'Відпустка', 'Стрибки з парашутом'];
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

// Mappings for database types
const ANNUAL_DB_MAP = {
  'Техніка пілотування': 'ТП',
  'ТП за дублями': 'ТП_дублюючі',
  'Навігація': 'навігація',
  'Бойове застосування': 'БЗ',
  'Інструкторська': 'інструкторська',
  'Методика ЛВ': 'Методика ЛВ',
  'Захід за приладами': 'Захід за приладами',
  'ТП з ІВД': 'ТП з ІВД',
};

// Mapping from UI label to normalized database LP type names
// Must match lp_type_normalized values in break_periods_lp table
const LP_BREAK_DB_MAP = {
  'Польоти на Нмал': 'мала_висота',
  'Польоти на СП': 'складний_пілотаж',
  'Повітр. бій з ударними': 'пб_ударні',
  'Повітр. бій з винищ.': 'пб_винищувачі',
  'Польоти на ГМВ (з ОНБ)': 'гмв_онб',
  'Польоти парою': 'групова_злітаність',
  'Польоти на БЗ': 'бойове_застосування',
  'БЗ по НЦ з ПВМ': 'бз_нц_прості',
  'БЗ по НЦ з СВМ': 'бз_нц_складні',
  'ПБ за нешвидк. ПЦ': 'пб_нешвидкісні',
  'Десантування': 'десантування',
  'Продовж. зліт/посадка': 'продовжений_зліт',
  'Пошуково-рятувальні': 'пошуково_рятувальні',
  'Зовнішня підвіска/евак.': 'зовнішня_підвіска',
};

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
  const [editModal, setEditModal] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = auth?.role === 'admin';

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    console.log('Loading readiness data...');
    const result = await getAllPilotsReadinessData();
    console.log('Load result:', result.ok, result.data?.pilots?.length, 'pilots');
    if (result.ok) {
      setData(result.data);
    }
    setLoading(false);
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    window.print();
  };

  const openEditModal = (pilotId, aircraftTypeId, category, categoryType, currentDate) => {
    setEditModal({ pilotId, aircraftTypeId, category, categoryType });
    setEditDate(currentDate || '');
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditDate('');
    setSaving(false);
  };

  const handleSaveDate = async () => {
    if (!editModal || !editDate) return;
    setSaving(true);

    let result;
    const { pilotId, aircraftTypeId, category, categoryType } = editModal;

    switch (categoryType) {
      case 'mu':
        result = await updateMuBreakDateInSupabase(pilotId, category, aircraftTypeId, editDate);
        break;
      case 'comm':
        // Для Ст. 205 ПРІАЗ передаємо aircraftTypeId
        result = await updateCommissionDateById(pilotId, category, editDate, aircraftTypeId);
        break;
      case 'annual':
        result = await updateAnnualCheckDateById(pilotId, ANNUAL_DB_MAP[category] || category, editDate);
        break;
      case 'lpBreak':
        result = await updateLpBreakDateById(pilotId, LP_BREAK_DB_MAP[category] || category, aircraftTypeId, editDate);
        break;
      default:
        result = { ok: false, error: 'Невідомий тип категорії' };
    }

    if (result.ok) {
      await load();
      closeEditModal();
    } else {
      alert('Помилка: ' + result.error);
      setSaving(false);
    }
  };

  const handleClearDate = async () => {
    if (!editModal) return;
    setSaving(true);

    let result;
    const { pilotId, aircraftTypeId, category, categoryType } = editModal;

    console.log('handleClearDate:', { pilotId, aircraftTypeId, category, categoryType });

    switch (categoryType) {
      case 'mu':
        result = await deleteMuBreakDateById(pilotId, category, aircraftTypeId);
        break;
      case 'comm':
        result = await deleteCommissionDateById(pilotId, category, aircraftTypeId);
        break;
      case 'annual':
        result = await deleteAnnualCheckDateById(pilotId, ANNUAL_DB_MAP[category] || category);
        break;
      case 'lpBreak':
        result = await deleteLpBreakDateById(pilotId, LP_BREAK_DB_MAP[category] || category, aircraftTypeId);
        break;
      default:
        result = { ok: false, error: 'Невідомий тип категорії' };
    }

    console.log('delete result:', result);

    if (result.ok) {
      await load();
      closeEditModal();
    } else {
      alert('Помилка: ' + result.error);
      setSaving(false);
    }
  };

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
        <thead className={s.tableHead}>
          {/* Group header row */}
          <tr className={s.tableHeader}>
            <th colSpan={4} className={s.thGroup}>Загальні дані</th>
            <th colSpan={6} className={s.thGroup}>Час доби та МУ</th>
            <th colSpan={6} className={s.thGroup}>Таблиця комісування</th>
            <th colSpan={8} className={s.thGroup}>Річні перевірки</th>
            <th colSpan={14} className={s.thGroup}>Перерви за видами ЛП</th>
          </tr>
          {/* Column header row */}
          <tr className={s.tableHeader}>
            <th className={s.thNum}>№</th>
            <th className={s.thName}>Пілот</th>
            <th className={s.thClass}>Клас</th>
            <th className={s.thAircraft}>Тип ПС</th>
            {MU_TYPES_LIST.map((t, idx) => <th key={t} className={`${s.thMu} ${idx === 0 ? s.colGroupStart : ''}`}>{t}</th>)}
            {COMM_TYPES_LIST.map((t, idx) => <th key={t} className={`${s.thComm} ${idx === 0 ? s.colGroupStart : ''}`}>{t}</th>)}
            {ANNUAL_TYPES_LIST.map((t, idx) => <th key={t} className={`${s.thAnnual} ${idx === 0 ? s.colGroupStart : ''}`}>{t}</th>)}
            {LP_BREAK_TYPES_LIST.map((t, idx) => <th key={t} className={`${s.thLpBreak} ${idx === 0 ? s.colGroupStart : ''}`}>{t}</th>)}
          </tr>
        </thead>
        <tbody className={s.tableBody}>
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
                  <td className={s.tdAircraft}>—</td>
                  {MU_TYPES_LIST.map((t, idx) => <DateCellTd key={t} date="" color="gray" editable={false} groupStart={idx === 0 ? 'Mu' : null} />)}
                  {COMM_TYPES_LIST.map((t, idx) => <DateCellTd key={t} date="" color="gray" editable={false} groupStart={idx === 0 ? 'Comm' : null} />)}
                  {ANNUAL_TYPES_LIST.map((t, idx) => <DateCellTd key={t} date="" color="gray" editable={false} groupStart={idx === 0 ? 'Annual' : null} />)}
                  {LP_BREAK_TYPES_LIST.map((t, idx) => <DateCellTd key={t} date="" color="gray" editable={false} groupStart={idx === 0 ? 'LpBreak' : null} />)}
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

                    <td className={s.tdAircraft}>{ac.name}</td>

                    {/* MU dates */}
                    {MU_TYPES_LIST.map((muType, idx) => {
                      const item = ac.mu?.[muType];
                      return (
                        <DateCellTd
                          key={muType}
                          date={item?.date}
                          color={item?.color}
                          editable={isAdmin}
                          groupStart={idx === 0 ? 'Mu' : null}
                          onClick={() => isAdmin && openEditModal(pilot.id, ac.aircraftTypeId, muType, 'mu', item?.date)}
                        />
                      );
                    })}

                    {/* Commission dates - some merged (rowspan), some per aircraft */}
                    {COMM_TYPES_LIST.map((commType, idx) => {
                      // Ст. 205 ПРІАЗ - окремо для кожного типу ПС
                      const isPerAircraft = commType === 'Ст. 205 ПРІАЗ';

                      if (isPerAircraft) {
                        // Показуємо для кожного типу ПС
                        const item = ac.comm?.[commType];
                        return (
                          <DateCellTd
                            key={commType}
                            date={item?.date}
                            color={item?.color}
                            editable={isAdmin}
                            groupStart={idx === 0 ? 'Comm' : null}
                            onClick={() => isAdmin && openEditModal(pilot.id, ac.aircraftTypeId, commType, 'comm', item?.date)}
                          />
                        );
                      } else {
                        // Об'єднані - тільки в першому рядку з rowspan
                        if (acIdx !== 0) return null;
                        let mergedItem = null;
                        for (const acItem of pilot.aircraft) {
                          const item = acItem.comm?.[commType];
                          if (item?.date) {
                            mergedItem = item;
                            break;
                          }
                        }
                        return (
                          <DateCellTd
                            key={commType}
                            date={mergedItem?.date}
                            color={mergedItem?.color}
                            editable={isAdmin}
                            groupStart={idx === 0 ? 'Comm' : null}
                            rowSpan={pilotRowSpan}
                            onClick={() => isAdmin && openEditModal(pilot.id, null, commType, 'comm', mergedItem?.date)}
                          />
                        );
                      }
                    })}

                    {/* Annual check dates - only in first aircraft row with rowspan */}
                    {acIdx === 0 && ANNUAL_TYPES_LIST.map((annType, idx) => {
                      // Об'єднуємо дати з усіх типів ПС - беремо першу доступну
                      let mergedItem = null;
                      for (const acItem of pilot.aircraft) {
                        const item = acItem.annual?.[annType];
                        if (item?.date) {
                          mergedItem = item;
                          break;
                        }
                      }
                      return (
                        <DateCellTd
                          key={annType}
                          date={mergedItem?.date}
                          color={mergedItem?.color}
                          editable={isAdmin}
                          groupStart={idx === 0 ? 'Annual' : null}
                          rowSpan={pilotRowSpan}
                          onClick={() => isAdmin && openEditModal(pilot.id, null, annType, 'annual', mergedItem?.date)}
                        />
                      );
                    })}

                    {/* LP Break dates */}
                    {LP_BREAK_TYPES_LIST.map((lpBreakType, idx) => {
                      const item = ac.lpBreak?.[lpBreakType];
                      return (
                        <DateCellTd
                          key={lpBreakType}
                          date={item?.date}
                          color={item?.color}
                          editable={isAdmin}
                          groupStart={idx === 0 ? 'LpBreak' : null}
                          onClick={() => isAdmin && openEditModal(pilot.id, ac.aircraftTypeId, lpBreakType, 'lpBreak', item?.date)}
                        />
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Edit Modal */}
      {editModal && (
        <div className={s.modalOverlay} onClick={closeEditModal}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <span className={s.modalTitle}>Редагувати дату</span>
              <button className={s.modalClose} onClick={closeEditModal}>
                <IoClose size={20} />
              </button>
            </div>
            <div className={s.modalBody}>
              <div className={s.modalLabel}>
                {editModal.categoryType === 'mu' && 'МУ: '}
                {editModal.categoryType === 'comm' && 'Комісування: '}
                {editModal.categoryType === 'annual' && 'Перевірка: '}
                {editModal.categoryType === 'lpBreak' && 'ЛП: '}
                {editModal.category}
              </div>
              <input
                type="text"
                className={s.modalInput}
                placeholder="ДД.ММ.РРРР"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
              />
            </div>
            <div className={s.modalFooter}>
              <button
                className={s.modalDeleteBtn}
                onClick={handleClearDate}
                disabled={saving}
              >
                Очистити
              </button>
              <button className={s.modalCancelBtn} onClick={closeEditModal}>
                Скасувати
              </button>
              <button
                className={s.modalSaveBtn}
                onClick={handleSaveDate}
                disabled={saving || !editDate}
              >
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
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

function DateCellTd({ date, color, editable, onClick, groupStart, rowSpan }) {
  const st = getStatus(color);
  const groupClass = groupStart ? s[`groupStart${groupStart}`] || '' : '';
  return (
    <td
      className={`${s.dateCell} ${editable ? s.dateCellEditable : ''} ${groupClass}`}
      style={{ backgroundColor: st.bg }}
      onClick={onClick}
      rowSpan={rowSpan}
    >
      <span style={{ color: st.text }}>{date || '—'}</span>
    </td>
  );
}
