import { supabase } from './supabase';

const MU_TYPES = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function computeColor(lastDate, allowedDays) {
  if (!lastDate || !allowedDays) return 'gray';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const last = new Date(lastDate);
  last.setHours(0, 0, 0, 0);
  const daysSince = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  const remaining = allowedDays - daysSince;
  if (remaining <= 0) return 'red';
  if (remaining <= 15) return 'yellow';
  return 'green';
}

function computeColorFromExpiry(expiryDate) {
  if (!expiryDate) return 'gray';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const remaining = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
  if (remaining <= 0) return 'red';
  if (remaining <= 15) return 'yellow';
  return 'green';
}

export async function getBreaksDataFromSupabase(pib) {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, military_class, test_class, coefficient')
      .eq('name', pib)
      .single();

    if (userError || !user) {
      return { ok: false, error: 'Користувача не знайдено' };
    }

    const userId = user.id;
    const milClass = user.military_class || 2;
    const coeff = 1.0;

    const [
      breaksMuRes, breaksLpRes, muDatesRes, lpDatesRes,
      commissionRes, aircraftRes, pilotSettingsRes, kbpMappingRes, userAircraftRes,
    ] = await Promise.all([
      supabase.from('break_periods_mu').select('*').eq('military_class', milClass),
      supabase.from('break_periods_lp').select('*').or(`military_class.eq.${milClass},military_class.is.null`),
      supabase.from('mu_break_dates').select('aircraft_type_id, mu_condition, last_date').eq('user_id', userId),
      supabase.from('lp_break_dates').select('lp_type, last_date, aircraft_type_id').eq('user_id', userId),
      supabase.from('commission_dates').select('commission_date, expiry_date, commission_type_id, commission_types(name, days)').eq('user_id', userId),
      supabase.from('aircraft_types').select('id, name'),
      supabase.from('pilots').select('entry_settings').eq('pib', pib).maybeSingle(),
      supabase.from('aircraft_kbp_mapping').select('aircraft_type_id, kbp_document, is_primary'),
      supabase.from('user_aircraft').select('aircraft_type_id').eq('user_id', userId),
    ]);

    const breaksMu = breaksMuRes.data || [];
    const breaksLp = breaksLpRes.data || [];
    const muDates = muDatesRes.data || [];
    const lpDates = lpDatesRes.data || [];
    const commissions = commissionRes.data || [];
    const aircraftTypes = aircraftRes.data || [];
    const kbpMappings = kbpMappingRes.data || [];
    const userAircraftList = userAircraftRes.data || [];

    let pilotAircraftTypes = null;
    if (pilotSettingsRes.data?.entry_settings) {
      try {
        const settings = typeof pilotSettingsRes.data.entry_settings === 'string' ? JSON.parse(pilotSettingsRes.data.entry_settings) : pilotSettingsRes.data.entry_settings;
        if (settings.aircraft_types && settings.aircraft_types.length > 0) {
          pilotAircraftTypes = settings.aircraft_types;
        }
      } catch (_) {}
    }

    const aircraftMap = {};
    const aircraftNameToId = {};
    aircraftTypes.forEach(a => { aircraftMap[a.id] = a.name; aircraftNameToId[a.name] = a.id; });

    const muAllowed = {};
    breaksMu.forEach(b => {
      muAllowed[b.mu_condition] = Math.floor(b.days * coeff);
    });

    const muByCondition = {};
    const userAircraftSet = new Set();
    muDates.forEach(row => {
      const acName = aircraftMap[row.aircraft_type_id] || String(row.aircraft_type_id);
      userAircraftSet.add(acName);
      if (!muByCondition[row.mu_condition]) muByCondition[row.mu_condition] = {};
      muByCondition[row.mu_condition][acName] = row.last_date;
    });

    const userAircraft = [...userAircraftSet];
    const muResult = {};
    MU_TYPES.forEach(mu => {
      const items = [];
      const acDates = muByCondition[mu] || {};
      userAircraft.forEach(acName => {
        const lastDate = acDates[acName] || null;
        const allowed = muAllowed[mu] || 0;
        let expiryDate = null;
        if (lastDate && allowed) {
          const exp = new Date(lastDate);
          exp.setDate(exp.getDate() + allowed);
          expiryDate = exp.toISOString().split('T')[0];
        }
        items.push({
          aircraft: acName,
          date: formatDate(lastDate),
          expiryDate: formatDate(expiryDate),
          color: lastDate ? computeColor(lastDate, allowed) : 'gray',
        });
      });
      muResult[mu] = items;
    });

    const aircraftToKbp = {};
    kbpMappings.forEach(m => {
      if (m.kbp_document === 'КЛПВ') return;
      if (!aircraftToKbp[m.aircraft_type_id]) aircraftToKbp[m.aircraft_type_id] = [];
      aircraftToKbp[m.aircraft_type_id].push(m.kbp_document);
    });

    const lpDateMap = {};
    lpDates.forEach(row => {
      if (!lpDateMap[row.lp_type]) lpDateMap[row.lp_type] = {};
      const key = row.aircraft_type_id != null ? row.aircraft_type_id : '_all';
      lpDateMap[row.lp_type][key] = row.last_date;
    });

    let pilotAcIds = userAircraftList.map(ua => ua.aircraft_type_id);
    if (pilotAcIds.length === 0) {
      const muAcIds = new Set();
      muDates.forEach(row => muAcIds.add(row.aircraft_type_id));
      pilotAcIds = [...muAcIds];
    }

    const kbpToAircraft = {};
    const activeKbps = new Set();
    const dependentAcIds = [];

    pilotAcIds.forEach(acId => {
      const kbps = aircraftToKbp[acId] || [];
      if (kbps.length === 1) {
        const kbp = kbps[0];
        activeKbps.add(kbp);
        if (!kbpToAircraft[kbp]) kbpToAircraft[kbp] = [];
        const acName = aircraftMap[acId];
        if (acName && !kbpToAircraft[kbp].includes(acName)) {
          kbpToAircraft[kbp].push(acName);
        }
      } else if (kbps.length > 1) {
        dependentAcIds.push(acId);
      }
    });

    dependentAcIds.forEach(acId => {
      const kbps = aircraftToKbp[acId] || [];
      kbps.forEach(kbp => {
        if (activeKbps.has(kbp)) {
          if (!kbpToAircraft[kbp]) kbpToAircraft[kbp] = [];
          const acName = aircraftMap[acId];
          if (acName && !kbpToAircraft[kbp].includes(acName)) {
            kbpToAircraft[kbp].push(acName);
          }
        }
      });
    });

    const kbpOrder = ['КБП ВА', 'КБП БА/РА', 'КБПВ'];
    const firstActiveKbp = kbpOrder.find(k => kbpToAircraft[k]?.length > 0) || null;
    const lpByKbp = {};
    breaksLp.forEach(b => {
      let kbp;
      if (b.kbp_document) {
        if (!kbpToAircraft[b.kbp_document]) return;
        kbp = b.kbp_document;
      } else {
        kbp = firstActiveKbp;
        if (!kbp) return;
      }
      if (!lpByKbp[kbp]) lpByKbp[kbp] = [];
      lpByKbp[kbp].push({
        displayName: b.lp_type,
        normalized: b.lp_type_normalized,
        timeOfDay: b.time_of_day || null,
        months: b.military_class == null ? b.months : Math.floor(b.months * coeff),
        sortOrder: b.sort_order,
      });
    });

    const hasAnyDate = (normalized) => {
      const m = lpDateMap[normalized];
      return m && Object.keys(m).length > 0;
    };
    Object.values(lpByKbp).forEach(arr => {
      arr.sort((a, b) => {
        if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
        if (a.sortOrder != null) return -1;
        if (b.sortOrder != null) return 1;
        const aHasDate = hasAnyDate(a.normalized) ? 0 : 1;
        const bHasDate = hasAnyDate(b.normalized) ? 0 : 1;
        if (aHasDate !== bHasDate) return aHasDate - bHasDate;
        return a.months - b.months;
      });
    });

    const lpSections = [];
    const lpResult = {};

    kbpOrder.forEach(kbp => {
      const aircraft = kbpToAircraft[kbp];
      if (!aircraft || aircraft.length === 0) return;
      const lpEntries = lpByKbp[kbp] || [];
      if (lpEntries.length === 0) return;

      lpEntries.forEach(cfg => {
        let displayKey = cfg.displayName;
        if (cfg.timeOfDay) {
          displayKey += cfg.timeOfDay === 'Д' ? ' (день)' : ' (ніч)';
        }

        const allowedDays = cfg.months * 30;
        const datesByAc = lpDateMap[cfg.normalized] || {};

        const items = aircraft.map(acName => {
          const acId = aircraftNameToId[acName];
          const lastDate = (acId && datesByAc[acId]) || datesByAc['_all'] || null;
          let expiryDate = null;
          if (lastDate && allowedDays) {
            const exp = new Date(lastDate);
            exp.setDate(exp.getDate() + allowedDays);
            expiryDate = exp.toISOString().split('T')[0];
          }
          const color = lastDate ? computeColor(lastDate, allowedDays) : 'gray';
          return {
            aircraft: acName,
            aircraftTypeId: acId || null,
            date: formatDate(lastDate),
            expiryDate: formatDate(expiryDate),
            color,
          };
        });

        lpSections.push({ type: 'lp', name: displayKey, normalized: cfg.normalized, items });
        lpResult[displayKey] = items;
      });
    });

    // === Conditional LP types (КБПВ) ===
    const LP_DEPENDENCIES = {
      'бз_нц_прості': ['малі_висоти'],
      'бз_нц_складні': ['малі_висоти', 'складний_пілотаж_мв'],
    };
    lpSections.forEach(section => {
      const deps = LP_DEPENDENCIES[section.normalized];
      if (!deps) return;
      const depSections = deps.map(depNorm =>
        lpSections.find(s => s.normalized === depNorm)
      ).filter(Boolean);
      section.items.forEach(item => {
        if (depSections.length < deps.length) { item.color = 'gray'; return; }
        let worst = 'green';
        depSections.forEach(depSection => {
          const depItem = depSection.items.find(di => di.aircraft === item.aircraft);
          if (!depItem || depItem.color === 'gray' || depItem.color === 'red') {
            worst = 'red';
          } else if (depItem.color === 'yellow' && worst !== 'red') {
            worst = 'yellow';
          }
        });
        item.color = worst;
      });
    });

    const LP_TYPES = Object.keys(lpResult);

    const rawCommission = {};
    commissions.forEach(c => {
      const typeName = c.commission_types?.name;
      if (!typeName) return;
      if (!rawCommission[typeName]) rawCommission[typeName] = [];
      rawCommission[typeName].push({
        rawDate: c.commission_date,
        rawExpiry: c.expiry_date,
        days: c.commission_types?.days,
      });
    });
    Object.values(rawCommission).forEach(arr => {
      arr.sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
    });

    const commissionResult = {};

    const llkEntries = rawCommission['ЛЛК'] || [];
    const umoEntries = rawCommission['УМО'] || [];
    const llkEntry = llkEntries.length > 0 ? llkEntries[0] : null;
    const umoEntry = umoEntries.length > 0 ? umoEntries[0] : null;

    const llkDate = llkEntry?.rawDate || null;
    const umoDate = umoEntry?.rawDate || null;

    function addMonths(dateStr, m) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      d.setMonth(d.getMonth() + m);
      return d.toISOString().split('T')[0];
    }

    const llkExpiry = addMonths(llkDate, 12);
    const umoExpiry = addMonths(umoDate, 6);

    let nextType = null;
    let nextDate = null;
    if (llkDate && umoDate) {
      if (new Date(umoDate) >= new Date(llkDate)) {
        nextType = 'ЛЛК';
        nextDate = umoExpiry;
      } else {
        nextType = 'УМО';
        nextDate = llkExpiry;
      }
    } else if (llkDate) {
      nextType = 'УМО';
      nextDate = llkExpiry;
    } else if (umoDate) {
      nextType = 'ЛЛК';
      nextDate = umoExpiry;
    }

    commissionResult['ЛЛК/УМО'] = {
      llk: llkDate ? { date: formatDate(llkDate), color: computeColorFromExpiry(llkExpiry) } : null,
      umo: umoDate ? { date: formatDate(umoDate), color: computeColorFromExpiry(umoExpiry) } : null,
      nextType,
      nextDate: formatDate(nextDate),
      nextColor: nextDate ? computeColorFromExpiry(nextDate) : 'gray',
    };

    const priaz = rawCommission['Ст. 205 ПРІАЗ'] || [];
    const priazEntry = priaz.length > 0 ? priaz[0] : null;
    const priazAircraft = pilotAircraftTypes || userAircraft;
    commissionResult['Ст. 205 ПРІАЗ'] = priazAircraft.map(ac => {
      if (priazEntry) {
        return {
          aircraft: ac,
          date: formatDate(priazEntry.rawDate),
          expiryDate: formatDate(priazEntry.rawExpiry),
          color: computeColorFromExpiry(priazEntry.rawExpiry),
        };
      }
      return { aircraft: ac, date: '', expiryDate: '', color: 'gray' };
    });

    ['Аварійне залишення', 'Відпустка', 'Стрибки з парашутом'].forEach(typeName => {
      const entries = rawCommission[typeName] || [];
      if (entries.length > 0) {
        const e = entries[0];
        commissionResult[typeName] = [{
          date: formatDate(e.rawDate),
          expiryDate: formatDate(e.rawExpiry),
          color: computeColorFromExpiry(e.rawExpiry),
        }];
      } else {
        commissionResult[typeName] = [];
      }
    });

    return {
      ok: true,
      data: {
        mu: muResult,
        lp: lpResult,
        lpTypes: LP_TYPES,
        lpSections: lpSections,
        commission: commissionResult,
      },
    };
  } catch (error) {
    console.error('getBreaksDataFromSupabase error:', error);
    return { ok: false, error: String(error.message || error) };
  }
}

export async function updateLpBreakDateInSupabase(pib, lpTypeNormalized, aircraftTypeId, dateStr) {
  try {
    const { data: user, error: userErr } = await supabase
      .from('users').select('id').eq('name', pib).single();
    if (userErr || !user) return { ok: false, error: 'Користувача не знайдено' };

    const parts = dateStr.split('.');
    if (parts.length !== 3) return { ok: false, error: 'Невірний формат дати' };
    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    let query = supabase
      .from('lp_break_dates')
      .select('id')
      .eq('user_id', user.id)
      .eq('lp_type', lpTypeNormalized);

    if (aircraftTypeId) {
      query = query.eq('aircraft_type_id', aircraftTypeId);
    } else {
      query = query.is('aircraft_type_id', null);
    }

    const { data: existing } = await query.limit(1);

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('lp_break_dates')
        .update({ last_date: isoDate })
        .eq('id', existing[0].id);
      if (error) throw error;
    } else {
      const row = { user_id: user.id, lp_type: lpTypeNormalized, last_date: isoDate };
      if (aircraftTypeId) row.aircraft_type_id = aircraftTypeId;
      const { error } = await supabase
        .from('lp_break_dates')
        .insert(row);
      if (error) throw error;
    }

    return { ok: true };
  } catch (error) {
    console.error('updateLpBreakDateInSupabase error:', error);
    return { ok: false, error: String(error.message || error) };
  }
}

export async function getAllPilotsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('name')
      .order('name');

    if (error) throw error;
    return { ok: true, pilots: (data || []).map(u => u.name) };
  } catch (error) {
    console.error('getAllPilotsFromSupabase error:', error);
    return { ok: false, pilots: [] };
  }
}

export async function getAnnualChecksFromSupabase(pib) {
  try {
    const { data: user, error: userError } = await supabase
      .from('users').select('id').eq('name', pib).single();

    if (userError || !user) return { ok: false, error: 'Користувача не знайдено' };

    const { data: checks, error: checksError } = await supabase
      .from('annual_checks')
      .select('check_type, check_date, expiry_date, months_valid')
      .eq('user_id', user.id);

    if (checksError) throw checksError;

    const byType = {};
    (checks || []).forEach(c => {
      const existing = byType[c.check_type];
      if (!existing || new Date(c.check_date) > new Date(existing.check_date)) {
        byType[c.check_type] = c;
      }
    });

    const result = Object.entries(byType).map(([checkType, c]) => ({
      check_type: checkType,
      date: formatDate(c.check_date),
      color: computeColorFromExpiry(c.expiry_date),
    }));

    return { ok: true, checks: result };
  } catch (error) {
    console.error('getAnnualChecksFromSupabase error:', error);
    return { ok: false, error: String(error.message || error) };
  }
}

export async function updateAnnualCheckDateInSupabase(pib, checkType, dateStr) {
  try {
    const { data: user, error: userErr } = await supabase
      .from('users').select('id').eq('name', pib).single();

    if (userErr || !user) return { ok: false, error: 'Користувача не знайдено' };

    const parts = dateStr.split('.');
    if (parts.length !== 3) return { ok: false, error: 'Невірний формат дати' };
    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    const monthsValid = 12;
    const d = new Date(isoDate);
    d.setMonth(d.getMonth() + monthsValid);
    const expiryDate = d.toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('annual_checks')
      .select('id')
      .eq('user_id', user.id)
      .eq('check_type', checkType)
      .limit(1);

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('annual_checks')
        .update({ check_date: isoDate, expiry_date: expiryDate })
        .eq('id', existing[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('annual_checks')
        .insert({
          user_id: user.id,
          check_type: checkType,
          check_date: isoDate,
          months_valid: monthsValid,
          expiry_date: expiryDate,
        });
      if (error) throw error;
    }

    return { ok: true };
  } catch (error) {
    console.error('updateAnnualCheckDateInSupabase error:', error);
    return { ok: false, error: String(error.message || error) };
  }
}

export async function updateCommissionDateInSupabase(pib, category, dateStr) {
  try {
    const { data: user, error: userErr } = await supabase
      .from('users').select('id').eq('name', pib).single();

    if (userErr || !user) return { ok: false, error: 'Користувача не знайдено' };

    const parts = dateStr.split('.');
    if (parts.length !== 3) return { ok: false, error: 'Невірний формат дати' };
    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    const { data: cType, error: ctErr } = await supabase
      .from('commission_types')
      .select('id, days')
      .eq('name', category)
      .single();

    if (ctErr || !cType) return { ok: false, error: 'Тип комісування не знайдено: ' + category };

    const d = new Date(isoDate);
    if (category === 'ЛЛК') {
      d.setMonth(d.getMonth() + 12);
    } else if (category === 'УМО') {
      d.setMonth(d.getMonth() + 6);
    } else {
      d.setDate(d.getDate() + cType.days);
    }
    const expiryDate = d.toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('commission_dates')
      .select('id')
      .eq('user_id', user.id)
      .eq('commission_type_id', cType.id)
      .limit(1);

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('commission_dates')
        .update({ commission_date: isoDate, expiry_date: expiryDate })
        .eq('id', existing[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('commission_dates')
        .insert({
          user_id: user.id,
          commission_type_id: cType.id,
          commission_date: isoDate,
          expiry_date: expiryDate,
        });
      if (error) throw error;
    }

    return { ok: true };
  } catch (error) {
    console.error('updateCommissionDateInSupabase error:', error);
    return { ok: false, error: String(error.message || error) };
  }
}

/* ── Readiness dashboard: all pilots overview (Excel format with dates per aircraft) ── */

const MU_TYPES_LIST = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];

// LP Break columns (Перерви за видами ЛП) - 14 types
const LP_BREAK_COL_DEFS = [
  { label: 'Польоти на Нмал', match: n => n === 'мала_висота' || n.startsWith('малі_висоти') },
  { label: 'Польоти на СП', match: n => n.startsWith('складний_пілотаж') },
  { label: 'Повітр. бій з ударними', match: n => n === 'повітряний_бій_з_ударними' },
  { label: 'Повітр. бій з винищ.', match: n => n === 'повітряний_бій_з_винищувачами' },
  { label: 'Польоти на ГМВ (з ОНБ)', match: n => n === 'гмв_онб' },
  { label: 'Польоти парою', match: n => n.startsWith('групова_злітаність') || n === 'група' },
  { label: 'Польоти на БЗ', match: n => n === 'бойове_застосування' },
  { label: 'БЗ по НЦ з ПВМ', match: n => n === 'бз_нц_прості' },
  { label: 'БЗ по НЦ з СВМ', match: n => n === 'бз_нц_складні' },
  { label: 'ПБ за нешвидк. ПЦ', match: n => n === 'пб_нешвидкісні_пц' },
  { label: 'Десантування', match: n => n.startsWith('десантування') },
  { label: 'Продовж. зліт/посадка', match: n => n === 'продовжений_зліт' },
  { label: 'Пошуково-рятувальні', match: n => n === 'пошуково_рятувальні' },
  { label: 'Зовнішня підвіска/евак.', match: n => n === 'зовнішня_підвіска_евакуація' },
];

const COMM_TYPES_LIST = ['Аварійне залишення', 'Ст. 205 ПРІАЗ', 'ЛЛК', 'УМО', 'Відпустка', 'Стрибки з парашутом'];

const ANNUAL_MAP_LIST = [
  { dbType: 'ТП', label: 'Техніка пілотування' },
  { dbType: 'ТП_дублюючі', label: 'ТП за дублями' },
  { dbType: 'навігація', label: 'Навігація' },
  { dbType: 'БЗ', label: 'Бойове застосування' },
  { dbType: 'інструкторська', label: 'Інструкторська' },
  { dbType: 'Методика ЛВ', label: 'Методика ЛВ' },
  { dbType: 'Захід за приладами', label: 'Захід за приладами' },
  { dbType: 'ТП з ІВД', label: 'ТП з ІВД' },
];

function worstColor(a, b) {
  const order = { red: 0, yellow: 1, green: 2, gray: 3 };
  return (order[a] ?? 3) < (order[b] ?? 3) ? a : b;
}

export async function getAllPilotsReadinessData() {
  try {
    const [
      usersRes, muDatesRes, lpDatesRes, commDatesRes, annualRes,
      breaksMuRes, breaksLpRes, aircraftRes, kbpMapRes, userAcRes,
    ] = await Promise.all([
      supabase.from('users').select('id, name, rank, position, military_class, test_class, coefficient, sort_order, role').order('sort_order'),
      supabase.from('mu_break_dates').select('user_id, aircraft_type_id, mu_condition, last_date'),
      supabase.from('lp_break_dates').select('user_id, lp_type, last_date, aircraft_type_id'),
      supabase.from('commission_dates').select('user_id, commission_date, expiry_date, commission_type_id, commission_types(name, days)'),
      supabase.from('annual_checks').select('user_id, check_type, check_date, expiry_date'),
      supabase.from('break_periods_mu').select('*'),
      supabase.from('break_periods_lp').select('lp_type_normalized, military_class, months, kbp_document'),
      supabase.from('aircraft_types').select('id, name'),
      supabase.from('aircraft_kbp_mapping').select('aircraft_type_id, kbp_document'),
      supabase.from('user_aircraft').select('user_id, aircraft_type_id'),
    ]);

    const users = usersRes.data || [];
    const allMuDates = muDatesRes.data || [];
    const allLpDates = lpDatesRes.data || [];
    const allCommissions = commDatesRes.data || [];
    const allAnnual = annualRes.data || [];
    const breaksMuAll = breaksMuRes.data || [];
    const breaksLpAll = breaksLpRes.data || [];
    const aircraftTypes = aircraftRes.data || [];
    const kbpMappings = kbpMapRes.data || [];
    const userAircraftAll = userAcRes.data || [];

    const aircraftMap = {};
    aircraftTypes.forEach(a => { aircraftMap[a.id] = a.name; });

    const aircraftToKbp = {};
    kbpMappings.forEach(m => {
      if (m.kbp_document === 'КЛПВ') return;
      if (!aircraftToKbp[m.aircraft_type_id]) aircraftToKbp[m.aircraft_type_id] = [];
      if (!aircraftToKbp[m.aircraft_type_id].includes(m.kbp_document))
        aircraftToKbp[m.aircraft_type_id].push(m.kbp_document);
    });

    const muPeriodsByClass = {};
    breaksMuAll.forEach(b => {
      if (!muPeriodsByClass[b.military_class]) muPeriodsByClass[b.military_class] = {};
      muPeriodsByClass[b.military_class][b.mu_condition] = b.days;
    });

    const groupBy = (arr, key) => {
      const m = {};
      arr.forEach(r => { if (!m[r[key]]) m[r[key]] = []; m[r[key]].push(r); });
      return m;
    };
    const muByUser = groupBy(allMuDates, 'user_id');
    const lpByUser = groupBy(allLpDates, 'user_id');
    const commByUser = groupBy(allCommissions, 'user_id');
    const annualByUser = groupBy(allAnnual, 'user_id');

    const userAcByUser = {};
    userAircraftAll.forEach(r => {
      if (!userAcByUser[r.user_id]) userAcByUser[r.user_id] = [];
      userAcByUser[r.user_id].push(r.aircraft_type_id);
    });

    // Helper: format date
    const fmtDate = (dateStr) => {
      if (!dateStr || dateStr.startsWith('1900')) return '';
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    };

    // Helper: get aircraft data with dates per category
    const getAircraftData = (userId, userAcIds, muPeriods) => {
      const acData = [];

      if (userAcIds.length === 0) {
        // No aircraft - return empty row
        return [null];
      }

      userAcIds.forEach(acId => {
        const acName = aircraftMap[acId] || `#${acId}`;
        const muDates = muByUser[userId] || [];
        const lpDates = lpByUser[userId] || [];
        const commDates = commByUser[userId] || [];
        const annDates = annualByUser[userId] || [];

        // MU dates per aircraft
        const mu = {};
        MU_TYPES_LIST.forEach(muType => {
          const entry = muDates.find(e =>
            e.aircraft_type_id === acId && e.mu_condition === muType
          );
          const allowed = muPeriods[muType] || 0;
          mu[muType] = {
            date: fmtDate(entry?.last_date),
            color: entry ? computeColor(entry.last_date, allowed) : 'gray'
          };
        });

        // LP break dates per aircraft
        const lpBreak = {};
        LP_BREAK_COL_DEFS.forEach(col => {
          const entry = lpDates.find(e =>
            e.aircraft_type_id === acId && col.match(e.lp_type)
          );
          const months = getLpBreakMonths(col.label, acId);
          lpBreak[col.label] = {
            date: fmtDate(entry?.last_date),
            color: entry ? computeColor(entry.last_date, months * 30) : 'gray'
          };
        });

        // Commission dates (not per aircraft, but overall for pilot)
        const comm = {};
        COMM_TYPES_LIST.forEach(ct => {
          const entry = commDates.find(e => e.commission_types?.name === ct);
          comm[ct] = {
            date: fmtDate(entry?.commission_date),
            color: entry ? computeColorFromExpiry(entry.expiry_date) : 'gray'
          };
        });

        // Annual check dates (not per aircraft)
        const annual = {};
        ANNUAL_MAP_LIST.forEach(({ dbType, label }) => {
          const entry = annDates.find(e => e.check_type === dbType);
          annual[label] = {
            date: fmtDate(entry?.check_date),
            color: entry ? computeColorFromExpiry(entry.expiry_date) : 'gray'
          };
        });

        acData.push({
          name: acName,
          mu, lpBreak, comm, annual
        });
      });

      return acData;
    };

    // Helper: get LP break months for matching
    const getLpBreakMonths = (lpBreakLabel, acId) => {
      const match = breaksLpAll.find(bp => {
        if (bp.kbp_document && bp.kbp_document !== 'КЛПВ') {
          // Check if aircraft uses this KBP
          const acKbps = aircraftToKbp[acId] || [];
          if (!acKbps.includes(bp.kbp_document)) return false;
        }
        return LP_BREAK_COL_DEFS.find(col => col.label === lpBreakLabel)?.match(bp.lp_type_normalized);
      });
      return match?.months || 0;
    };

    const pilots = users.map(user => {
      const userId = user.id;
      const milClass = user.military_class || 2;
      const coeff = 1.0;
      const muPeriods = muPeriodsByClass[milClass] || {};

      let userAcIds = userAcByUser[userId] || [];
      if (userAcIds.length === 0) {
        const s = new Set();
        (muByUser[userId] || []).forEach(r => s.add(r.aircraft_type_id));
        userAcIds = [...s];
      }

      const aircraft = getAircraftData(userId, userAcIds, muPeriods);

      // Calculate overall status for summary
      let worstStatus = 'gray';
      aircraft.forEach(ac => {
        if (!ac) return;
        [...Object.values(ac.mu), ...Object.values(ac.lp), ...Object.values(ac.comm), ...Object.values(ac.annual)].forEach(c => {
          if (c.color !== 'gray') worstStatus = worstColor(worstStatus, c.color);
        });
      });

      return {
        id: userId,
        name: user.name,
        rank: user.rank || '',
        position: user.position || '',
        militaryClass: user.military_class || 2,
        testClass: user.test_class || '',
        aircraft,
        overallStatus: worstStatus
      };
    });

    const summary = { total: pilots.length, green: 0, yellow: 0, red: 0 };
    pilots.forEach(p => {
      if (p.overallStatus === 'green') summary.green++;
      else if (p.overallStatus === 'yellow') summary.yellow++;
      else if (p.overallStatus === 'red') summary.red++;
    });

    return { ok: true, data: { pilots, summary } };
  } catch (error) {
    console.error('getAllPilotsReadinessData error:', error);
    return { ok: false, error: String(error.message || error) };
  }
}
