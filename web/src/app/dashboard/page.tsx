'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSpreadsheetData, SpreadsheetData, CellData } from '@/lib/data';
import { StatusColor } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const cellColors: Record<StatusColor, string> = {
  green: 'bg-emerald-50 text-emerald-800',
  yellow: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-white text-gray-300',
};

// Frozen column widths (px) — must match between th and td
const COL_W = { num: 28, pos: 108, pib: 160, kl: 28, tps: 64 };
const LEFT = {
  num: 0,
  pos: COL_W.num,
  pib: COL_W.num + COL_W.pos,
  kl: COL_W.num + COL_W.pos + COL_W.pib,
  tps: COL_W.num + COL_W.pos + COL_W.pib + COL_W.kl,
};

function StatusCell({ cell, onClick }: { cell?: CellData; onClick?: () => void }) {
  const c = cell || { date: '', color: 'gray' as StatusColor };
  return (
    <td
      className={`px-1.5 py-1 text-center text-[11px] whitespace-nowrap border border-gray-200 cursor-pointer hover:brightness-95 ${cellColors[c.color]}`}
      onClick={onClick}
    >
      {c.date || '—'}
    </td>
  );
}

function SpanCell({ cell, rowSpan, onClick }: { cell?: CellData; rowSpan: number; onClick?: () => void }) {
  const c = cell || { date: '', color: 'gray' as StatusColor };
  return (
    <td
      rowSpan={rowSpan}
      className={`px-1.5 py-1 text-center text-[11px] whitespace-nowrap border border-gray-200 cursor-pointer hover:brightness-95 ${cellColors[c.color]}`}
      onClick={onClick}
    >
      {c.date || '—'}
    </td>
  );
}

function EditModal({ title, value, onSave, onClose }: {
  title: string;
  value: string;
  onSave: (val: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState(value);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 print:hidden" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-80 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="text-sm text-text-secondary mb-3">{title}</div>
        <input
          type="date"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-border text-sm outline-none focus:border-accent"
          autoFocus
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-border text-sm text-text-secondary cursor-pointer"
          >
            Скасувати
          </button>
          <button
            onClick={() => onSave(input)}
            className="flex-1 h-9 rounded-lg bg-primary text-white text-sm cursor-pointer"
          >
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}

type EditTarget = {
  pilotId: string;
  pilotName: string;
  category: 'mu' | 'lp' | 'commission' | 'annual';
  subType: string;
  aircraftTypeId?: number;
  currentDate: string;
};

export default function DashboardPage() {
  const [data, setData] = useState<SpreadsheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    getSpreadsheetData()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function displayToIso(ddmmyyyy: string): string {
    if (!ddmmyyyy || ddmmyyyy === '—') return '';
    const parts = ddmmyyyy.split('.');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  async function handleSave(isoDate: string) {
    if (!editTarget || !isoDate) return;

    try {
      const userId = editTarget.pilotId;

      if (editTarget.category === 'mu') {
        const { data: existing } = await supabase
          .from('mu_break_dates').select('id')
          .eq('user_id', userId).eq('mu_condition', editTarget.subType)
          .eq('aircraft_type_id', editTarget.aircraftTypeId!).limit(1);

        if (existing && existing.length > 0) {
          await supabase.from('mu_break_dates').update({ last_date: isoDate }).eq('id', existing[0].id);
        } else {
          await supabase.from('mu_break_dates').insert({
            user_id: userId, mu_condition: editTarget.subType,
            aircraft_type_id: editTarget.aircraftTypeId!, last_date: isoDate,
          });
        }
      } else if (editTarget.category === 'lp') {
        const { data: existing } = await supabase
          .from('lp_break_dates').select('id')
          .eq('user_id', userId).eq('lp_type', editTarget.subType).limit(1);

        if (existing && existing.length > 0) {
          await supabase.from('lp_break_dates').update({ last_date: isoDate }).eq('id', existing[0].id);
        } else {
          await supabase.from('lp_break_dates').insert({
            user_id: userId, lp_type: editTarget.subType, last_date: isoDate,
          });
        }
      } else if (editTarget.category === 'commission') {
        const { data: cType } = await supabase
          .from('commission_types').select('id, days').eq('name', editTarget.subType).single();
        if (!cType) throw new Error('Commission type not found');

        const d = new Date(isoDate);
        if (editTarget.subType === 'ЛЛК') d.setMonth(d.getMonth() + 12);
        else if (editTarget.subType === 'УМО') d.setMonth(d.getMonth() + 6);
        else d.setDate(d.getDate() + cType.days);
        const expiryDate = d.toISOString().split('T')[0];

        const { data: existing } = await supabase
          .from('commission_dates').select('id')
          .eq('user_id', userId).eq('commission_type_id', cType.id).limit(1);

        if (existing && existing.length > 0) {
          await supabase.from('commission_dates')
            .update({ commission_date: isoDate, expiry_date: expiryDate }).eq('id', existing[0].id);
        } else {
          await supabase.from('commission_dates').insert({
            user_id: userId, commission_type_id: cType.id,
            commission_date: isoDate, expiry_date: expiryDate,
          });
        }
      } else if (editTarget.category === 'annual') {
        const d = new Date(isoDate);
        d.setMonth(d.getMonth() + 12);
        const expiryDate = d.toISOString().split('T')[0];

        const { data: existing } = await supabase
          .from('annual_checks').select('id')
          .eq('user_id', userId).eq('check_type', editTarget.subType).limit(1);

        if (existing && existing.length > 0) {
          await supabase.from('annual_checks')
            .update({ check_date: isoDate, expiry_date: expiryDate }).eq('id', existing[0].id);
        } else {
          await supabase.from('annual_checks').insert({
            user_id: userId, check_type: editTarget.subType,
            check_date: isoDate, months_valid: 12, expiry_date: expiryDate,
          });
        }
      }

      setEditTarget(null);
      loadData();
    } catch (err: unknown) {
      alert('Помилка: ' + (err instanceof Error ? err.message : err));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-text-secondary text-sm">Завантаження...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-error text-sm">{error}</div>
      </div>
    );
  }

  const { pilots, muTypes, lpTypes, commissionTypes, annualCheckTypes } = data;

  const totalPilots = pilots.length;
  const readyCount = pilots.filter(p => p.overallStatus === 'green').length;
  const attentionCount = pilots.filter(p => p.overallStatus === 'yellow').length;
  const expiredCount = pilots.filter(p => p.overallStatus === 'red').length;

  const muLabels: Record<string, string> = {
    'ДПМУ': 'Д ПМУ', 'ДСМУ': 'Д СМУ', 'ДВМП': 'Д ВМП',
    'НПМУ': 'Н ПМУ', 'НСМУ': 'Н СМУ', 'НВМП': 'Н ВМП',
  };

  const annualLabels: Record<string, string> = {
    'ТП': 'ТП', 'ТП_дублюючі': 'ТП дубл.', 'ТП з ІВД': 'ТП ІВД',
    'відмова_двигуна': 'Відм. дв.', 'навігація': 'Навігація', 'БЗ': 'БЗ',
    'інструкторська': 'Інструкт.', 'Методика ЛВ': 'Мет. ЛВ',
    'Захід за приладами': 'Захід прил.', 'Льотна підготовка': 'ЛП',
  };

  const commLabels: Record<string, string> = {
    'Аварійне залишення': 'Авар. зал.', 'Ст. 205 ПРІАЗ': 'Ст.205',
    'ЛЛК': 'ЛЛК', 'УМО': 'УМО', 'Відпустка': 'Відпустка',
    'Стрибки з парашутом': 'Стрибки',
  };

  const lpLabels: Record<string, string> = {
    'Складний пілотаж': 'Скл. піл.', 'Мала висота': 'Мала вис.',
    'Гр. мала висота (ОНБ)': 'ГМВ/ОНБ', 'Бойове застосування': 'Бойове заст.',
    'Групова злітаність': 'Груп. зліт.', 'На десантування': 'Десант.', 'РСНГ': 'РСНГ',
  };

  // Sticky styles — shared between th and td
  const stickyNum = { position: 'sticky' as const, left: LEFT.num, zIndex: 12 };
  const stickyPos = { position: 'sticky' as const, left: LEFT.pos, zIndex: 12 };
  const stickyPib = { position: 'sticky' as const, left: LEFT.pib, zIndex: 12 };
  const stickyKl = { position: 'sticky' as const, left: LEFT.kl, zIndex: 12 };
  const stickyTps = { position: 'sticky' as const, left: LEFT.tps, zIndex: 12, boxShadow: '2px 0 4px rgba(0,0,0,0.08)' };

  const stickyHeadNum = { ...stickyNum, zIndex: 30 };
  const stickyHeadPos = { ...stickyPos, zIndex: 30 };
  const stickyHeadPib = { ...stickyPib, zIndex: 30 };
  const stickyHeadKl = { ...stickyKl, zIndex: 30 };
  const stickyHeadTps = { ...stickyTps, zIndex: 30 };

  const groupTh = 'px-2 py-1.5 text-[11px] text-center whitespace-nowrap border border-gray-300 bg-gray-800 text-white';
  const subTh = 'px-1.5 py-1 text-[10px] text-center whitespace-nowrap border border-gray-300 bg-gray-100 text-gray-600';
  const frozenTd = 'px-2 py-1 text-[11px] whitespace-nowrap border border-gray-200';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0 print:py-1">
        <h1 className="text-sm text-gray-800">Стан бойової готовності</h1>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-gray-500">{totalPilots} пілотів</span>
          <span className="text-emerald-600">{readyCount} готові</span>
          <span className="text-amber-600">{attentionCount} увага</span>
          <span className="text-red-600">{expiredCount} прострочені</span>
          <button
            onClick={() => window.print()}
            className="ml-3 px-3 py-1 text-[11px] rounded border border-gray-300 text-gray-600 cursor-pointer hover:bg-gray-50 print:hidden"
          >
            Друкувати
          </button>
        </div>
      </div>

      {/* Table wrapper */}
      <div className="flex-1 overflow-auto print:overflow-visible">
        <table className="border-collapse">
          <thead className="sticky top-0 z-20 print:static">
            {/* Group header row */}
            <tr>
              <th className={groupTh} rowSpan={2} style={{ ...stickyHeadNum, width: COL_W.num, minWidth: COL_W.num }}>№</th>
              <th className={`${groupTh} text-left`} rowSpan={2} style={{ ...stickyHeadPos, width: COL_W.pos, minWidth: COL_W.pos }}>Посада</th>
              <th className={`${groupTh} text-left`} rowSpan={2} style={{ ...stickyHeadPib, width: COL_W.pib, minWidth: COL_W.pib }}>ПІБ</th>
              <th className={groupTh} rowSpan={2} style={{ ...stickyHeadKl, width: COL_W.kl, minWidth: COL_W.kl }}>Кл</th>
              <th className={groupTh} rowSpan={2} style={{ ...stickyHeadTps, width: COL_W.tps, minWidth: COL_W.tps }}>Тип ПС</th>

              <th className={groupTh} colSpan={muTypes.length}>Перерви за МУ</th>
              <th className={groupTh} colSpan={annualCheckTypes.length}>Перевірки</th>
              <th className={groupTh} colSpan={commissionTypes.length}>Комісування</th>
              <th className={groupTh} colSpan={lpTypes.length}>Перерви за видами ЛП</th>
            </tr>

            {/* Sub-header row */}
            <tr>
              {muTypes.map(m => (
                <th key={m} className={subTh}>{muLabels[m] || m}</th>
              ))}
              {annualCheckTypes.map(ct => (
                <th key={ct} className={subTh}>{annualLabels[ct] || ct}</th>
              ))}
              {commissionTypes.map(ct => (
                <th key={ct} className={subTh}>{commLabels[ct] || ct}</th>
              ))}
              {lpTypes.map(lp => (
                <th key={lp} className={subTh}>{lpLabels[lp] || lp}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {pilots.map((pilot, idx) => {
              const acNames = pilot.aircraftNames.length > 0 ? pilot.aircraftNames : [''];
              const rowSpan = acNames.length;
              const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';

              return acNames.map((acName, acIdx) => (
                <tr key={`${pilot.user.id}-${acIdx}`} style={{ backgroundColor: rowBg }}>
                  {/* Frozen identity columns — first sub-row only */}
                  {acIdx === 0 && (
                    <>
                      <td className={`${frozenTd} text-center text-gray-400`} rowSpan={rowSpan} style={{ ...stickyNum, backgroundColor: rowBg }}>{idx + 1}</td>
                      <td className={`${frozenTd} text-gray-600`} rowSpan={rowSpan} style={{ ...stickyPos, backgroundColor: rowBg }}>{pilot.user.position || ''}</td>
                      <td className={frozenTd} rowSpan={rowSpan} style={{ ...stickyPib, backgroundColor: rowBg }}>
                        <Link href={`/dashboard/${pilot.user.id}`} className="text-gray-800 no-underline hover:text-blue-600 print:text-black">
                          {pilot.user.name}
                        </Link>
                      </td>
                      <td className={`${frozenTd} text-center`} rowSpan={rowSpan} style={{ ...stickyKl, backgroundColor: rowBg }}>{pilot.user.military_class || '—'}</td>
                    </>
                  )}

                  <td className={`${frozenTd} text-center text-gray-600`} style={{ ...stickyTps, backgroundColor: rowBg }}>{acName}</td>

                  {/* MU — per aircraft */}
                  {muTypes.map(muType => {
                    const cell = pilot.mu[muType]?.[acName];
                    return (
                      <StatusCell
                        key={muType}
                        cell={cell}
                        onClick={() => {
                          setEditTarget({
                            pilotId: pilot.user.id, pilotName: pilot.user.name,
                            category: 'mu', subType: muType, currentDate: cell?.date || '',
                          });
                          supabase.from('aircraft_types').select('id').eq('name', acName).single()
                            .then(({ data: at }) => {
                              if (at) setEditTarget(prev => prev ? { ...prev, aircraftTypeId: at.id } : null);
                            });
                        }}
                      />
                    );
                  })}

                  {/* Annual checks — first row, rowSpan */}
                  {acIdx === 0 && annualCheckTypes.map(ct => (
                    <SpanCell key={ct} cell={pilot.annualChecks[ct]} rowSpan={rowSpan}
                      onClick={() => setEditTarget({
                        pilotId: pilot.user.id, pilotName: pilot.user.name,
                        category: 'annual', subType: ct, currentDate: pilot.annualChecks[ct]?.date || '',
                      })}
                    />
                  ))}

                  {/* Commissions — first row, rowSpan */}
                  {acIdx === 0 && commissionTypes.map(ct => (
                    <SpanCell key={ct} cell={pilot.commissions[ct]} rowSpan={rowSpan}
                      onClick={() => setEditTarget({
                        pilotId: pilot.user.id, pilotName: pilot.user.name,
                        category: 'commission', subType: ct, currentDate: pilot.commissions[ct]?.date || '',
                      })}
                    />
                  ))}

                  {/* LP — per aircraft */}
                  {lpTypes.map(lpType => {
                    const cell = pilot.lp[lpType]?.[acName];
                    return (
                      <StatusCell
                        key={lpType}
                        cell={cell}
                        onClick={() => setEditTarget({
                          pilotId: pilot.user.id, pilotName: pilot.user.name,
                          category: 'lp', subType: lpType, currentDate: cell?.date || '',
                        })}
                      />
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <EditModal
          title={`${editTarget.pilotName} — ${editTarget.subType}`}
          value={displayToIso(editTarget.currentDate)}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
