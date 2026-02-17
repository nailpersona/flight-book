'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoClose, IoAddOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import s from './fuel.module.css';

const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

// Конвертація кг в тонни з заокругленням до сотих
function kgToTons(kg) {
  if (!kg || kg === 0) return 0;
  return Math.round(kg / 10) / 100;
}

// Форматування тонни з комою
function formatTons(val) {
  if (!val && val !== 0) return '';
  return val.toFixed(2).replace('.', ',').replace(/,00$/, '').replace(/(\d),0$/, '$1');
}

export default function FuelPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [airfields, setAirfields] = useState([]);
  const [balances, setBalances] = useState([]);
  const [fuelRecords, setFuelRecords] = useState([]);
  const [currentYear] = useState(new Date().getFullYear());
  const [addModal, setAddModal] = useState(null);
  const [addAmount, setAddAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const canEdit = auth?.role === 'admin' || auth?.position === 'Заступник командира в/ч А3444 з ЛП';

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const { data: af, error: afErr } = await supabase.from('airfields').select('*').order('code');
      if (afErr) console.error('airfields error:', afErr);
      if (af) setAirfields(af);

      const { data: bal, error: balErr } = await supabase.from('fuel_balances').select('*, airfields(code)');
      if (balErr) console.error('balances error:', balErr);
      if (bal) setBalances(bal);

      const { data: fr, error: frErr } = await supabase
        .from('fuel_records')
        .select('id, airfield, fuel_amount, flights(date, users(name))')
        .not('airfield', 'is', null)
        .gt('fuel_amount', 0);
      if (frErr) console.error('fuel_records error:', frErr);
      if (fr) setFuelRecords(fr);
    } catch (e) {
      console.error('load error:', e);
    }
    setLoading(false);
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  const getBalance = (airfieldCode, month) => {
    const b = balances.find(x => x.airfields?.code === airfieldCode && x.year === currentYear && x.month === month);
    return b;
  };

  // Підсумок за рік для аеродрому
  const getYearSummary = (airfieldCode) => {
    let totalIncome = 0;
    let totalExpense = 0;

    for (let m = 1; m <= 12; m++) {
      const b = getBalance(airfieldCode, m);
      if (b) {
        totalIncome += b.income || 0;
        totalExpense += b.expense || 0;
      }
    }

    const remaining = totalIncome - totalExpense;
    return {
      income: kgToTons(totalIncome),
      remaining: kgToTons(remaining),
      isNegative: remaining < 0
    };
  };

  const openAddModal = (airfieldId, airfieldCode, month, currentIncome) => {
    setAddModal({ airfieldId, airfieldCode, month, currentIncome: currentIncome || 0 });
    setAddAmount('');
  };

  const closeAddModal = () => {
    setAddModal(null);
    setAddAmount('');
    setSaving(false);
  };

  const handleAddFuel = async () => {
    if (!addModal || !addAmount) return;
    setSaving(true);

    const { airfieldId, month, currentIncome } = addModal;
    // Конвертуємо тонни в кг для зберігання
    const tonsValue = parseFloat(addAmount.replace(',', '.'));
    const kgValue = Math.round(tonsValue * 1000);
    const newIncome = (currentIncome || 0) + kgValue;

    const existing = balances.find(b => b.airfield_id === airfieldId && b.year === currentYear && b.month === month);

    if (existing) {
      await supabase.from('fuel_balances').update({ income: newIncome }).eq('id', existing.id);
    } else {
      await supabase.from('fuel_balances').insert({
        airfield_id: airfieldId,
        year: currentYear,
        month: month,
        start_balance: 0,
        income: newIncome,
        expense: 0
      });
    }

    await load();
    closeAddModal();
  };

  const getMonthRecords = (airfieldCode, month) => {
    return fuelRecords.filter(r => {
      const matchAirfield = r.airfield === airfieldCode ||
        r.airfield?.startsWith(airfieldCode) ||
        r.airfield?.includes(airfieldCode);
      if (!matchAirfield) return false;
      const date = r.flights?.date;
      if (!date) return false;
      const d = new Date(date);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === month;
    });
  };

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

  if (loading || !auth) {
    return (
      <div className={s.loading}>
        <div className={s.spinner}></div>
      </div>
    );
  }

  if (airfields.length === 0) {
    return (
      <div className={s.container}>
        <div className={s.header}>
          <button className={s.backBtn} onClick={() => router.push('/tabs/readiness')}>
            <IoChevronBack size={20} />
          </button>
          <div className={s.titleBlock}>
            <div className={s.title}>Виділене паливо</div>
          </div>
        </div>
        <div className={s.loading}>
          <div>Аеродроми не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.container}>
      <div className={s.header}>
        <button className={s.backBtn} onClick={() => router.push('/tabs/readiness')}>
          <IoChevronBack size={20} />
        </button>
        <div className={s.titleBlock}>
          <div className={s.title}>Виділене паливо на {todayStr}</div>
        </div>
      </div>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead className={s.thead}>
            <tr>
              <th className={s.thAirfield}>Аеродром</th>
              {MONTHS.map((m, i) => (
                <th key={i} className={s.thMonth}>{m}</th>
              ))}
              <th className={s.thSummary}>Підсумок</th>
            </tr>
          </thead>
          <tbody>
            {airfields.map(af => (
              <AirfieldRow
                key={af.id}
                airfield={af}
                year={currentYear}
                balances={balances}
                records={fuelRecords}
                canEdit={canEdit}
                onAddClick={openAddModal}
                getBalance={getBalance}
                getMonthRecords={getMonthRecords}
                getYearSummary={getYearSummary}
              />
            ))}
          </tbody>
        </table>
      </div>

      {addModal && (
        <div className={s.modalOverlay} onClick={closeAddModal}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <span className={s.modalTitle}>Додати паливо</span>
              <button className={s.modalClose} onClick={closeAddModal}>
                <IoClose size={20} />
              </button>
            </div>
            <div className={s.modalBody}>
              <div className={s.modalLabel}>
                {addModal.airfieldCode} — {MONTHS[addModal.month - 1]}
              </div>
              <input
                type="text"
                inputMode="decimal"
                className={s.modalInput}
                placeholder="Кількість (тонни)"
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
              />
            </div>
            <div className={s.modalFooter}>
              <button className={s.modalCancelBtn} onClick={closeAddModal}>
                Скасувати
              </button>
              <button
                className={s.modalSaveBtn}
                onClick={handleAddFuel}
                disabled={saving || !addAmount}
              >
                {saving ? 'Збереження...' : 'Додати'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AirfieldRow({ airfield, year, balances, records, canEdit, onAddClick, getBalance, getMonthRecords, getYearSummary }) {
  const [expanded, setExpanded] = useState(false);
  const code = airfield.code;
  const name = airfield.name;

  const toggleExpand = () => setExpanded(!expanded);
  const summary = getYearSummary(code);

  return (
    <>
      <tr className={s.airfieldRow}>
        <td className={s.tdAirfield} onClick={toggleExpand}>
          <span className={s.airfieldCode}>{code}</span>
          <span className={s.airfieldName}> ({name})</span>
          <span className={s.expandIcon}>{expanded ? '−' : '+'}</span>
        </td>
        {MONTHS.map((_, idx) => {
          const month = idx + 1;
          const b = getBalance(code, month);
          const endBalanceKg = b?.end_balance ?? 0;
          const endBalanceTons = kgToTons(endBalanceKg);
          const isNegative = endBalanceKg < 0;

          return (
            <td
              key={month}
              className={`${s.tdCell} ${isNegative ? s.negative : ''} ${canEdit ? s.editable : ''}`}
              onClick={() => canEdit && onAddClick(airfield.id, code, month, b?.income)}
            >
              {endBalanceKg !== 0 ? (
                <span className={s.balanceValue}>{formatTons(endBalanceTons)}т</span>
              ) : (
                canEdit && <IoAddOutline size={16} color="#9CA3AF" />
              )}
            </td>
          );
        })}
        <td className={`${s.tdSummary} ${summary.isNegative ? s.negative : ''}`}>
          {summary.income > 0 ? `${formatTons(summary.income)}т/${formatTons(summary.remaining)}т` : ''}
        </td>
      </tr>
      {expanded && (
        <PilotRecords
          airfieldCode={code}
          year={year}
          records={records}
          getMonthRecords={getMonthRecords}
        />
      )}
    </>
  );
}

function PilotRecords({ airfieldCode, year, records, getMonthRecords }) {
  const monthRecords = {};
  for (let m = 1; m <= 12; m++) {
    monthRecords[m] = getMonthRecords(airfieldCode, m);
  }

  const allPilots = new Map();
  Object.values(monthRecords).flat().forEach(r => {
    const pilotName = r.flights?.users?.name;
    if (pilotName && !allPilots.has(pilotName)) {
      allPilots.set(pilotName, []);
    }
    if (pilotName) {
      allPilots.get(pilotName).push(r);
    }
  });

  if (allPilots.size === 0) return null;

  return (
    <>
      {Array.from(allPilots.entries()).map(([pilotName, pilotRecords]) => {
        const pilotMonthAmounts = {};
        for (let m = 1; m <= 12; m++) {
          const mr = monthRecords[m].filter(r => r.flights?.users?.name === pilotName);
          pilotMonthAmounts[m] = mr.reduce((sum, r) => sum + (r.fuel_amount || 0), 0);
        }

        const totalExpense = Object.values(pilotMonthAmounts).reduce((a, b) => a + b, 0);
        const totalTons = kgToTons(totalExpense);

        return (
          <tr key={pilotName} className={s.pilotRow}>
            <td className={s.tdPilot}>{pilotName}</td>
            {MONTHS.map((_, idx) => {
              const month = idx + 1;
              const amountKg = pilotMonthAmounts[month];
              const amountTons = kgToTons(amountKg);
              return (
                <td key={month} className={s.tdPilotCell}>
                  {amountKg > 0 ? <span>{formatTons(amountTons)}т</span> : ''}
                </td>
              );
            })}
            <td className={s.tdPilotSummary}>{formatTons(totalTons)}т</td>
          </tr>
        );
      })}
    </>
  );
}
