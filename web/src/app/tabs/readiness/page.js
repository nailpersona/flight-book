'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoPrintOutline, IoBarChart, IoClose, IoWater } from 'react-icons/io5';
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

// Positions for ДНДІ group (in order)
const DNDI_POSITIONS = [
  'Заступник командира в/ч А3444 з ЛП',
  'Начальник СБП в/ч А3444',
  'Начальник ЛМВ в/ч А3444',
  'Головний штурман в/ч А3444',
];

// Check if position belongs to ДНДІ group
const isDndiPosition = (position) => DNDI_POSITIONS.includes(position);

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

// Which KBP each LP type belongs to (null = common to all)
const LP_TYPE_KBP_MAP = {
  'мала_висота': null,           // Common (КБП ВА + КБПВ)
  'складний_пілотаж': 'КБП ВА',  // КБП ВА only
  'пб_ударні': 'КБП ВА',         // КБП ВА only
  'пб_винищувачі': 'КБП ВА',     // КБП ВА only
  'гмв_онб': 'КБПВ',             // КБПВ only
  'групова_злітаність': null,    // Common
  'бойове_застосування': 'КБПВ', // КБПВ only
  'бз_нц_прості': 'КБПВ',        // КБПВ only
  'бз_нц_складні': 'КБПВ',       // КБПВ only
  'пб_нешвидкісні': 'КБП ВА',    // КБП ВА only
  'десантування': 'КБПВ',        // КБПВ only
  'продовжений_зліт': 'КБПВ',    // КБПВ only
  'пошуково_рятувальні': 'КБПВ', // КБПВ only
  'зовнішня_підвіска': 'КБПВ',   // КБПВ only
};

// Check if LP type is compatible with pilot's KBP
const isLpTypeCompatible = (lpTypeLabel, primaryKbp) => {
  const normalized = LP_BREAK_DB_MAP[lpTypeLabel];
  const requiredKbp = LP_TYPE_KBP_MAP[normalized];
  // null means common to all, otherwise must match
  if (requiredKbp === null) return true;
  return primaryKbp === requiredKbp;
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

  const canEdit = auth?.role === 'admin' || auth?.canEditReadiness === true;

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
          <div className={s.title}>Зведена таблиця льотної підготовки</div>
        </div>
        <div className={s.actions}>
          <button className={s.actionBtn} onClick={() => router.push('/tabs/summary-all')}>
            <IoBarChart size={16} />
            Підсумки
          </button>
          <button className={s.actionBtn} onClick={() => router.push('/tabs/fuel')}>
            <IoWater size={16} />
            Паливо
          </button>
          <button className={s.actionBtn} onClick={handlePrint}>
            <IoPrintOutline size={16} />
            Друк
          </button>
        </div>
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
          {(() => {
            let dndiHeaderShown = false;
            let lvkHeaderShown = false;

            // Sort pilots: ДНДІ positions first (in order), then others
            const sortedPilots = [...data.pilots].sort((a, b) => {
              const aIndex = DNDI_POSITIONS.indexOf(a.position);
              const bIndex = DNDI_POSITIONS.indexOf(b.position);
              const aIsDndi = aIndex !== -1;
              const bIsDndi = bIndex !== -1;

              if (aIsDndi && bIsDndi) return aIndex - bIndex; // Both ДНДІ - sort by order
              if (aIsDndi) return -1; // a is ДНДІ, comes first
              if (bIsDndi) return 1;  // b is ДНДІ, comes first
              return 0; // Neither is ДНДІ - keep original order
            });

            return sortedPilots.map((pilot, pilotIdx) => {
              const isDndi = isDndiPosition(pilot.position);

              // Determine which headers to show
              const showDndiHeader = isDndi && !dndiHeaderShown;
              const showLvKHeader = !isDndi && !lvkHeaderShown;

              if (showDndiHeader) dndiHeaderShown = true;
              if (showLvKHeader) lvkHeaderShown = true;

              const rowNum = pilotIdx + 1;
              const aircraftCount = pilot.aircraft.length || 1;
              const pilotRowSpan = aircraftCount;

              // Section header rows
              const sectionHeaderRows = (showDndiHeader || showLvKHeader) ? (
                <>
                  {showDndiHeader && (
                    <tr key="section-dndi" className={s.sectionHeaderRow}>
                      <td colSpan={4 + 6 + 6 + 8 + 14} className={s.sectionHeaderCell}>
                        ДЕРЖАВНИЙ НАУКОВО-ДОСЛІДНИЙ ІНСТИТУТ ВИПРОБУВАНЬ І СЕРТИФІКАЦІЇ ОЗБРОЄННЯ ТА ВІЙСЬКОВОЇ ТЕХНІКИ
                      </td>
                    </tr>
                  )}
                  {showLvKHeader && (
                    <tr key="section-lvk" className={s.sectionHeaderRow}>
                      <td colSpan={4 + 6 + 6 + 8 + 14} className={s.sectionHeaderCell}>
                        ЛЬОТНО-ВИПРОБУВАЛЬНИЙ КОМПЛЕКС
                      </td>
                    </tr>
                  )}
                </>
              ) : null;

            if (pilot.aircraft.length === 0) {
              // Pilot with no aircraft - single empty row
              return (
                <React.Fragment key={pilot.id}>
                  {sectionHeaderRows}
                  <tr className={s.pilotRow}>
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
                </React.Fragment>
              );
            }

            // Pilot with aircraft - first row has pilot info with rowspan
            return (
              <React.Fragment key={pilot.id}>
                {sectionHeaderRows}
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
                          editable={canEdit}
                          groupStart={idx === 0 ? 'Mu' : null}
                          onClick={() => canEdit && openEditModal(pilot.id, ac.aircraftTypeId, muType, 'mu', item?.date)}
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
                            editable={canEdit}
                            groupStart={idx === 0 ? 'Comm' : null}
                            onClick={() => canEdit && openEditModal(pilot.id, ac.aircraftTypeId, commType, 'comm', item?.date)}
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
                            editable={canEdit}
                            groupStart={idx === 0 ? 'Comm' : null}
                            rowSpan={pilotRowSpan}
                            onClick={() => canEdit && openEditModal(pilot.id, null, commType, 'comm', mergedItem?.date)}
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
                          editable={canEdit}
                          groupStart={idx === 0 ? 'Annual' : null}
                          rowSpan={pilotRowSpan}
                          onClick={() => canEdit && openEditModal(pilot.id, null, annType, 'annual', mergedItem?.date)}
                        />
                      );
                    })}

                    {/* LP Break dates */}
                    {LP_BREAK_TYPES_LIST.map((lpBreakType, idx) => {
                      const item = ac.lpBreak?.[lpBreakType];
                      const lpCompatible = isLpTypeCompatible(lpBreakType, ac.primaryKbp);
                      const lpCanEdit = canEdit && lpCompatible;
                      return (
                        <DateCellTd
                          key={lpBreakType}
                          date={item?.date}
                          color={item?.color}
                          editable={lpCanEdit}
                          groupStart={idx === 0 ? 'LpBreak' : null}
                          onClick={() => lpCanEdit && openEditModal(pilot.id, ac.aircraftTypeId, lpBreakType, 'lpBreak', item?.date)}
                        />
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            );
          });
        })()}
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
