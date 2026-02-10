import { supabase } from './supabase';

const MU_TYPES = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];

// Default LP types (fallback if no KBP mapping found)
const LP_TYPES_DEFAULT = [
  'Складний пілотаж',
  'Мала висота',
  'Гр. мала висота (ОНБ)',
  'Бойове застосування',
  'Групова злітаність',
  'На десантування',
];

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
    // 1. Find user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, military_class, test_class, coefficient')
      .eq('name', pib)
      .single();

    if (userError || !user) {
      console.warn('User not found by pib:', pib, userError);
      return { ok: false, error: 'Користувача не знайдено' };
    }

    const userId = user.id;
    const milClass = user.military_class || 2;
    const coeff = (user.test_class && user.coefficient) ? parseFloat(user.coefficient) : 1.0;

    // 2. Fetch all data in parallel
    const [
      breaksMuRes,
      breaksLpRes,
      muDatesRes,
      lpDatesRes,
      commissionRes,
      aircraftRes,
      pilotSettingsRes,
      kbpMappingRes,
      userAircraftRes,
    ] = await Promise.all([
      supabase.from('break_periods_mu').select('*').eq('military_class', milClass),
      supabase.from('break_periods_lp').select('*').eq('military_class', milClass),
      supabase.from('mu_break_dates').select('aircraft_type_id, mu_condition, last_date').eq('user_id', userId),
      supabase.from('lp_break_dates').select('lp_type, last_date').eq('user_id', userId),
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

    // Pilot settings — aircraft types from Settings page
    let pilotAircraftTypes = null;
    if (pilotSettingsRes.data?.entry_settings) {
      try {
        const settings = JSON.parse(pilotSettingsRes.data.entry_settings);
        if (settings.aircraft_types && settings.aircraft_types.length > 0) {
          pilotAircraftTypes = settings.aircraft_types;
        }
      } catch (_) {}
    }

    // Aircraft lookup
    const aircraftMap = {};
    aircraftTypes.forEach(a => { aircraftMap[a.id] = a.name; });

    // MU allowed days (with coefficient)
    const muAllowed = {};
    breaksMu.forEach(b => {
      muAllowed[b.mu_condition] = Math.floor(b.days * coeff);
    });

    // LP allowed months (with coefficient)
    const lpAllowed = {};
    breaksLp.forEach(b => {
      lpAllowed[b.lp_type] = Math.floor(b.months * coeff);
    });

    // 3. Build MU result from mu_break_dates table
    // Group by mu_condition -> array of { aircraft, date, color }
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

    // 4. Build LP result from lp_break_dates table
    // Determine which KBP documents apply to this pilot
    const pilotAircraftIds = userAircraftList.map(ua => ua.aircraft_type_id);
    const pilotKbpDocs = new Set();
    kbpMappings.forEach(m => {
      if (pilotAircraftIds.includes(m.aircraft_type_id)) {
        pilotKbpDocs.add(m.kbp_document);
      }
    });

    // Build dynamic LP types list:
    // 1) All types from break_periods_lp that match pilot's KBP docs (or have no KBP = legacy)
    // 2) All types the user has in lp_break_dates (including legacy types)
    const lpTypesSet = new Set();
    const lpTypeOrder = []; // preserve display order
    breaksLp.forEach(b => {
      if (!b.kbp_document || pilotKbpDocs.has(b.kbp_document)) {
        if (!lpTypesSet.has(b.lp_type)) {
          lpTypesSet.add(b.lp_type);
          lpTypeOrder.push(b.lp_type);
        }
      }
    });
    // Also include types from user's existing data
    lpDates.forEach(row => {
      if (!lpTypesSet.has(row.lp_type)) {
        lpTypesSet.add(row.lp_type);
        lpTypeOrder.push(row.lp_type);
      }
    });
    // Fallback: if no types found, use defaults
    const LP_TYPES = lpTypeOrder.length > 0 ? lpTypeOrder : LP_TYPES_DEFAULT;

    // Show per aircraft type (same date for all aircraft for now)
    const lpDateMap = {};
    lpDates.forEach(row => {
      lpDateMap[row.lp_type] = row.last_date;
    });

    const lpResult = {};
    LP_TYPES.forEach(lpType => {
      const lastDate = lpDateMap[lpType] || null;
      const months = lpAllowed[lpType] || 6;
      const allowedDays = months * 30;
      let expiryDate = null;
      if (lastDate && allowedDays) {
        const exp = new Date(lastDate);
        exp.setDate(exp.getDate() + allowedDays);
        expiryDate = exp.toISOString().split('T')[0];
      }
      const color = lastDate ? computeColor(lastDate, allowedDays) : 'gray';
      const items = userAircraft.map(acName => ({
        aircraft: acName,
        date: formatDate(lastDate),
        expiryDate: formatDate(expiryDate),
        color,
      }));
      lpResult[lpType] = items;
    });

    // 5. Commission dates — restructured
    // Group raw data by commission type name
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
    // Sort each group by date ascending
    Object.values(rawCommission).forEach(arr => {
      arr.sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
    });

    const commissionResult = {};

    // ЛЛК and УМО — separate commission types, each valid for 6 months
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

    const llkExpiry = addMonths(llkDate, 12); // ЛЛК valid for 1 year
    const umoExpiry = addMonths(umoDate, 6);  // УМО valid for 6 months

    // Determine what's next based on which was completed last
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
      llk: llkDate ? {
        date: formatDate(llkDate),
        color: computeColorFromExpiry(llkExpiry),
      } : null,
      umo: umoDate ? {
        date: formatDate(umoDate),
        color: computeColorFromExpiry(umoExpiry),
      } : null,
      nextType,
      nextDate: formatDate(nextDate),
      nextColor: nextDate ? computeColorFromExpiry(nextDate) : 'gray',
    };

    // Ст. 205 ПРІАЗ — per aircraft type from pilot settings
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

    // Other simple commission types
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
        commission: commissionResult,
      },
    };
  } catch (error) {
    console.error('getBreaksDataFromSupabase error:', error);
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
    return {
      ok: true,
      pilots: (data || []).map(u => u.name),
    };
  } catch (error) {
    console.error('getAllPilotsFromSupabase error:', error);
    return { ok: false, pilots: [] };
  }
}

export async function getAnnualChecksFromSupabase(pib) {
  try {
    // Find user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('name', pib)
      .single();

    if (userError || !user) {
      return { ok: false, error: 'Користувача не знайдено' };
    }

    // Fetch annual checks
    const { data: checks, error: checksError } = await supabase
      .from('annual_checks')
      .select('check_type, check_date, expiry_date, months_valid')
      .eq('user_id', user.id);

    if (checksError) throw checksError;

    // Build result — one entry per check_type (latest date if multiple)
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
    // Find user
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('name', pib)
      .single();

    if (userErr || !user) {
      return { ok: false, error: 'Користувача не знайдено' };
    }

    // Parse date DD.MM.YYYY -> YYYY-MM-DD
    const parts = dateStr.split('.');
    if (parts.length !== 3) return { ok: false, error: 'Невірний формат дати' };
    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    // All annual checks are 12 months valid
    const monthsValid = 12;
    const d = new Date(isoDate);
    d.setMonth(d.getMonth() + monthsValid);
    const expiryDate = d.toISOString().split('T')[0];

    // Check if entry exists
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
    // Find user
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('name', pib)
      .single();

    if (userErr || !user) {
      return { ok: false, error: 'Користувача не знайдено' };
    }

    // Parse date DD.MM.YYYY -> YYYY-MM-DD
    const parts = dateStr.split('.');
    if (parts.length !== 3) return { ok: false, error: 'Невірний формат дати' };
    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    // Find commission type (ЛЛК and УМО are now separate types)
    const isLlkOrUmo = category === 'ЛЛК' || category === 'УМО';

    const { data: cType, error: ctErr } = await supabase
      .from('commission_types')
      .select('id, days')
      .eq('name', category)
      .single();

    if (ctErr || !cType) {
      return { ok: false, error: 'Тип комісування не знайдено: ' + category };
    }

    // Compute expiry: ЛЛК = +12 months, УМО = +6 months, others = +days
    const d = new Date(isoDate);
    if (category === 'ЛЛК') {
      d.setMonth(d.getMonth() + 12);
    } else if (category === 'УМО') {
      d.setMonth(d.getMonth() + 6);
    } else {
      d.setDate(d.getDate() + cType.days);
    }
    const expiryDate = d.toISOString().split('T')[0];

    // Fetch existing entry for this type
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
