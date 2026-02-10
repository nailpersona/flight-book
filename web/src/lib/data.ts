import { supabase } from './supabase';
import {
  User,
  AircraftType,
  StatusColor,
  StatusItem,
  CommissionLlkUmo,
  PilotDashboardData,
  PilotSummary,
  FlightHourRow,
} from './types';
import {
  formatDate,
  computeColor,
  computeColorFromExpiry,
  addMonths,
  parseInterval,
  worstStatus,
} from './utils';

const MU_TYPES = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];

export async function getAllPilots(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, rank, position, military_class, test_class, coefficient, availability, sort_order')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getAircraftTypes(): Promise<Record<number, string>> {
  const { data } = await supabase.from('aircraft_types').select('id, name');
  const map: Record<number, string> = {};
  (data || []).forEach((a: AircraftType) => { map[a.id] = a.name; });
  return map;
}

export async function getPilotDashboard(userId: string): Promise<PilotDashboardData> {
  // Fetch user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, name, rank, position, military_class, test_class, coefficient, availability, sort_order')
    .eq('id', userId)
    .single();

  if (userError || !user) throw new Error('User not found');

  const milClass = user.military_class || 2;

  // Fetch all data in parallel
  const [
    breaksMuRes,
    breaksLpRes,
    muDatesRes,
    lpDatesRes,
    commissionRes,
    aircraftMap,
    kbpMappingRes,
    userAircraftRes,
    annualChecksRes,
    flightsRes,
  ] = await Promise.all([
    supabase.from('break_periods_mu').select('*').eq('military_class', milClass),
    supabase.from('break_periods_lp').select('*').eq('military_class', milClass),
    supabase.from('mu_break_dates').select('aircraft_type_id, mu_condition, last_date').eq('user_id', userId),
    supabase.from('lp_break_dates').select('lp_type, last_date').eq('user_id', userId),
    supabase.from('commission_dates').select('commission_date, expiry_date, commission_type_id, commission_types(name, days)').eq('user_id', userId),
    getAircraftTypes(),
    supabase.from('aircraft_kbp_mapping').select('aircraft_type_id, kbp_document, is_primary'),
    supabase.from('user_aircraft').select('aircraft_type_id').eq('user_id', userId),
    supabase.from('annual_checks').select('check_type, check_date, expiry_date, months_valid').eq('user_id', userId),
    supabase.from('flights').select('aircraft_type_id, flight_time, combat_applications, flights_count').eq('user_id', userId),
  ]);

  const breaksMu = breaksMuRes.data || [];
  const breaksLp = breaksLpRes.data || [];
  const muDates = muDatesRes.data || [];
  const lpDates = lpDatesRes.data || [];
  const commissions = commissionRes.data || [];
  const kbpMappings = kbpMappingRes.data || [];
  const userAircraftList = userAircraftRes.data || [];
  const annualChecksRaw = annualChecksRes.data || [];
  const flights = flightsRes.data || [];

  // MU allowed days
  const muAllowed: Record<string, number> = {};
  breaksMu.forEach((b: { mu_condition: string; days: number }) => {
    muAllowed[b.mu_condition] = b.days;
  });

  // LP allowed months
  const lpAllowed: Record<string, number> = {};
  breaksLp.forEach((b: { lp_type: string; months: number }) => {
    lpAllowed[b.lp_type] = b.months;
  });

  // Aircraft names from MU dates
  const userAircraftSet = new Set<string>();
  const muByCondition: Record<string, Record<string, string>> = {};
  muDates.forEach((row: { aircraft_type_id: number; mu_condition: string; last_date: string }) => {
    const acName = aircraftMap[row.aircraft_type_id] || String(row.aircraft_type_id);
    userAircraftSet.add(acName);
    if (!muByCondition[row.mu_condition]) muByCondition[row.mu_condition] = {};
    muByCondition[row.mu_condition][acName] = row.last_date;
  });
  const aircraftNames = [...userAircraftSet];

  // Build MU result
  const mu: Record<string, StatusItem[]> = {};
  MU_TYPES.forEach(muType => {
    const items: StatusItem[] = [];
    const acDates = muByCondition[muType] || {};
    aircraftNames.forEach(acName => {
      const lastDate = acDates[acName] || null;
      const allowed = muAllowed[muType] || 0;
      let expiryDate: string | null = null;
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
    mu[muType] = items;
  });

  // Build LP types list based on pilot's KBP documents
  const pilotAircraftIds = userAircraftList.map((ua: { aircraft_type_id: number }) => ua.aircraft_type_id);
  const pilotKbpDocs = new Set<string>();
  kbpMappings.forEach((m: { aircraft_type_id: number; kbp_document: string }) => {
    if (pilotAircraftIds.includes(m.aircraft_type_id)) {
      pilotKbpDocs.add(m.kbp_document);
    }
  });

  const lpTypesSet = new Set<string>();
  const lpTypeOrder: string[] = [];
  breaksLp.forEach((b: { lp_type: string; kbp_document: string | null }) => {
    if (!b.kbp_document || pilotKbpDocs.has(b.kbp_document)) {
      if (!lpTypesSet.has(b.lp_type)) {
        lpTypesSet.add(b.lp_type);
        lpTypeOrder.push(b.lp_type);
      }
    }
  });
  lpDates.forEach((row: { lp_type: string }) => {
    if (!lpTypesSet.has(row.lp_type)) {
      lpTypesSet.add(row.lp_type);
      lpTypeOrder.push(row.lp_type);
    }
  });
  const lpTypes = lpTypeOrder.length > 0 ? lpTypeOrder : ['Складний пілотаж', 'Мала висота', 'Бойове застосування'];

  // Build LP result
  const lpDateMap: Record<string, string> = {};
  lpDates.forEach((row: { lp_type: string; last_date: string }) => {
    lpDateMap[row.lp_type] = row.last_date;
  });

  const lp: Record<string, StatusItem[]> = {};
  lpTypes.forEach(lpType => {
    const lastDate = lpDateMap[lpType] || null;
    const months = lpAllowed[lpType] || 6;
    const allowedDays = months * 30;
    let expiryDate: string | null = null;
    if (lastDate && allowedDays) {
      const exp = new Date(lastDate);
      exp.setDate(exp.getDate() + allowedDays);
      expiryDate = exp.toISOString().split('T')[0];
    }
    const color: StatusColor = lastDate ? computeColor(lastDate, allowedDays) : 'gray';
    lp[lpType] = [{
      date: formatDate(lastDate),
      expiryDate: formatDate(expiryDate),
      color,
    }];
  });

  // Commissions
  const rawCommission: Record<string, { rawDate: string; rawExpiry: string | null; days: number }[]> = {};
  commissions.forEach((c: { commission_date: string; expiry_date: string | null; commission_types: { name: string; days: number }[] }) => {
    const ct = Array.isArray(c.commission_types) ? c.commission_types[0] : c.commission_types;
    const typeName = ct?.name;
    if (!typeName) return;
    if (!rawCommission[typeName]) rawCommission[typeName] = [];
    rawCommission[typeName].push({
      rawDate: c.commission_date,
      rawExpiry: c.expiry_date || null,
      days: ct?.days || 0,
    });
  });
  Object.values(rawCommission).forEach(arr => {
    arr.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());
  });

  const commission: Record<string, CommissionLlkUmo | StatusItem[]> = {};

  // ЛЛК/УМО
  const llkEntries = rawCommission['ЛЛК'] || [];
  const umoEntries = rawCommission['УМО'] || [];
  const llkEntry = llkEntries.length > 0 ? llkEntries[0] : null;
  const umoEntry = umoEntries.length > 0 ? umoEntries[0] : null;

  const llkDate = llkEntry?.rawDate || null;
  const umoDate = umoEntry?.rawDate || null;
  const llkExpiry = addMonths(llkDate, 12);
  const umoExpiry = addMonths(umoDate, 6);

  let nextType: string | null = null;
  let nextDate: string | null = null;
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

  commission['ЛЛК/УМО'] = {
    llk: llkDate ? { date: formatDate(llkDate), color: computeColorFromExpiry(llkExpiry) } : null,
    umo: umoDate ? { date: formatDate(umoDate), color: computeColorFromExpiry(umoExpiry) } : null,
    nextType,
    nextDate: formatDate(nextDate),
    nextColor: nextDate ? computeColorFromExpiry(nextDate) : 'gray',
  } satisfies CommissionLlkUmo;

  // Ст. 205 ПРІАЗ
  const priaz = rawCommission['Ст. 205 ПРІАЗ'] || [];
  const priazEntry = priaz.length > 0 ? priaz[0] : null;
  commission['Ст. 205 ПРІАЗ'] = aircraftNames.map(ac => {
    if (priazEntry) {
      return {
        aircraft: ac,
        date: formatDate(priazEntry.rawDate),
        expiryDate: formatDate(priazEntry.rawExpiry),
        color: computeColorFromExpiry(priazEntry.rawExpiry),
      };
    }
    return { aircraft: ac, date: '', expiryDate: '', color: 'gray' as StatusColor };
  });

  // Other commission types
  ['Аварійне залишення', 'Відпустка', 'Стрибки з парашутом'].forEach(typeName => {
    const entries = rawCommission[typeName] || [];
    if (entries.length > 0) {
      const e = entries[0];
      commission[typeName] = [{
        date: formatDate(e.rawDate),
        expiryDate: formatDate(e.rawExpiry),
        color: computeColorFromExpiry(e.rawExpiry),
      }];
    } else {
      commission[typeName] = [];
    }
  });

  // Annual checks — latest per type
  const byType: Record<string, { check_date: string; expiry_date: string | null }> = {};
  annualChecksRaw.forEach((c: { check_type: string; check_date: string; expiry_date: string | null }) => {
    const existing = byType[c.check_type];
    if (!existing || new Date(c.check_date) > new Date(existing.check_date)) {
      byType[c.check_type] = c;
    }
  });
  const annualChecks = Object.entries(byType).map(([checkType, c]) => ({
    check_type: checkType,
    date: formatDate(c.check_date),
    color: computeColorFromExpiry(c.expiry_date) as StatusColor,
  }));

  // Flight hours aggregation
  const flightAgg: Record<number, { count: number; minutes: number; combat: number }> = {};
  flights.forEach((f: { aircraft_type_id: number | null; flight_time: string | null; combat_applications: number | null; flights_count: number | null }) => {
    const atId = f.aircraft_type_id;
    if (!atId) return;
    if (!flightAgg[atId]) flightAgg[atId] = { count: 0, minutes: 0, combat: 0 };
    flightAgg[atId].count += f.flights_count || 1;
    flightAgg[atId].minutes += parseInterval(f.flight_time);
    flightAgg[atId].combat += f.combat_applications || 0;
  });

  const flightHours: FlightHourRow[] = Object.entries(flightAgg).map(([atIdStr, agg]) => ({
    aircraftName: aircraftMap[Number(atIdStr)] || atIdStr,
    flightsCount: agg.count,
    totalMinutes: agg.minutes,
    combatTotal: agg.combat,
  }));

  return {
    user,
    aircraftNames,
    mu,
    lp,
    lpTypes,
    commission,
    annualChecks,
    flightHours,
  };
}

// ── Spreadsheet-style: full data for all pilots in one go ──

export interface CellData {
  date: string;
  color: StatusColor;
}

export interface PilotRow {
  user: User;
  aircraftNames: string[];
  mu: Record<string, Record<string, CellData>>; // mu_condition -> aircraft -> cell
  lp: Record<string, Record<string, CellData>>; // lp_type -> aircraft -> cell
  commissions: Record<string, CellData>; // commission_type -> cell
  annualChecks: Record<string, CellData>; // check_type -> cell
  overallStatus: StatusColor;
}

export interface SpreadsheetData {
  pilots: PilotRow[];
  allAircraftNames: string[];
  muTypes: string[];
  lpTypes: string[];
  commissionTypes: string[];
  annualCheckTypes: string[];
}

const COMMISSION_TYPES_ORDER = ['Аварійне залишення', 'Ст. 205 ПРІАЗ', 'ЛЛК', 'УМО', 'Відпустка', 'Стрибки з парашутом'];
const ANNUAL_CHECK_TYPES_ORDER = ['ТП', 'ТП_дублюючі', 'ТП з ІВД', 'відмова_двигуна', 'навігація', 'БЗ', 'інструкторська', 'Методика ЛВ', 'Захід за приладами', 'Льотна підготовка'];

export async function getSpreadsheetData(): Promise<SpreadsheetData> {
  const users = await getAllPilots();
  const aircraftMap = await getAircraftTypes();

  const [
    allMuDates,
    allLpDates,
    allCommissions,
    allAnnualChecks,
    allBreaksMu,
    allBreaksLp,
    allUserAircraft,
    allKbpMappings,
  ] = await Promise.all([
    supabase.from('mu_break_dates').select('user_id, aircraft_type_id, mu_condition, last_date'),
    supabase.from('lp_break_dates').select('user_id, lp_type, last_date'),
    supabase.from('commission_dates').select('user_id, commission_date, expiry_date, commission_type_id, commission_types(name, days)'),
    supabase.from('annual_checks').select('user_id, check_type, check_date, expiry_date'),
    supabase.from('break_periods_mu').select('*'),
    supabase.from('break_periods_lp').select('*'),
    supabase.from('user_aircraft').select('user_id, aircraft_type_id'),
    supabase.from('aircraft_kbp_mapping').select('aircraft_type_id, kbp_document'),
  ]);

  const muDatesAll = allMuDates.data || [];
  const lpDatesAll = allLpDates.data || [];
  const commissionsAll = allCommissions.data || [];
  const annualChecksAll = allAnnualChecks.data || [];
  const breaksMuAll = allBreaksMu.data || [];
  const breaksLpAll = allBreaksLp.data || [];
  const userAircraftAll = allUserAircraft.data || [];
  const kbpMappingsAll = allKbpMappings.data || [];

  // Collect all LP types and annual check types across all pilots
  const allLpTypesSet = new Set<string>();
  const allAnnualCheckTypesSet = new Set<string>();
  const allAircraftNamesSet = new Set<string>();

  const pilots: PilotRow[] = users.map(user => {
    const milClass = user.military_class || 2;

    // MU allowed days
    const muAllowed: Record<string, number> = {};
    breaksMuAll
      .filter((b: { military_class: number }) => b.military_class === milClass)
      .forEach((b: { mu_condition: string; days: number }) => {
        muAllowed[b.mu_condition] = b.days;
      });

    // Aircraft for this pilot
    const userMuDates = muDatesAll.filter((m: { user_id: string }) => m.user_id === user.id);
    const acSet = new Set<string>();
    userMuDates.forEach((row: { aircraft_type_id: number }) => {
      const name = aircraftMap[row.aircraft_type_id] || String(row.aircraft_type_id);
      acSet.add(name);
      allAircraftNamesSet.add(name);
    });
    const aircraftNames = [...acSet];

    // MU: condition -> aircraft -> cell
    const mu: Record<string, Record<string, CellData>> = {};
    MU_TYPES.forEach(muType => {
      mu[muType] = {};
      const rows = userMuDates.filter((m: { mu_condition: string }) => m.mu_condition === muType);
      rows.forEach((row: { aircraft_type_id: number; last_date: string }) => {
        const acName = aircraftMap[row.aircraft_type_id] || String(row.aircraft_type_id);
        const allowed = muAllowed[muType] || 0;
        mu[muType][acName] = {
          date: formatDate(row.last_date),
          color: computeColor(row.last_date, allowed),
        };
      });
    });

    // LP
    const lpAllowed: Record<string, number> = {};
    breaksLpAll
      .filter((b: { military_class: number }) => b.military_class === milClass)
      .forEach((b: { lp_type: string; months: number }) => {
        lpAllowed[b.lp_type] = b.months;
      });

    const pilotAircraftIds = userAircraftAll
      .filter((ua: { user_id: string }) => ua.user_id === user.id)
      .map((ua: { aircraft_type_id: number }) => ua.aircraft_type_id);
    const pilotKbpDocs = new Set<string>();
    kbpMappingsAll.forEach((m: { aircraft_type_id: number; kbp_document: string }) => {
      if (pilotAircraftIds.includes(m.aircraft_type_id)) {
        pilotKbpDocs.add(m.kbp_document);
      }
    });

    const userLpDates = lpDatesAll.filter((l: { user_id: string }) => l.user_id === user.id);
    const lp: Record<string, Record<string, CellData>> = {};

    // Collect LP types applicable to this pilot
    const pilotLpTypes = new Set<string>();
    breaksLpAll
      .filter((b: { military_class: number }) => b.military_class === milClass)
      .forEach((b: { lp_type: string; kbp_document: string | null }) => {
        if (!b.kbp_document || pilotKbpDocs.has(b.kbp_document)) {
          pilotLpTypes.add(b.lp_type);
          allLpTypesSet.add(b.lp_type);
        }
      });
    userLpDates.forEach((row: { lp_type: string }) => {
      pilotLpTypes.add(row.lp_type);
      allLpTypesSet.add(row.lp_type);
    });

    // Build LP data per aircraft (same date for all aircraft, matching mobile app)
    pilotLpTypes.forEach(lpType => {
      const row = userLpDates.find((l: { lp_type: string }) => l.lp_type === lpType);
      const months = lpAllowed[lpType] || 6;
      lp[lpType] = {};
      aircraftNames.forEach(acName => {
        if (row) {
          lp[lpType][acName] = {
            date: formatDate(row.last_date),
            color: computeColor(row.last_date, months * 30),
          };
        }
      });
    });

    // Commissions
    const userCommissions = commissionsAll.filter((c: { user_id: string }) => c.user_id === user.id);
    const commissions: Record<string, CellData> = {};
    userCommissions.forEach((c: { commission_date: string; expiry_date: string | null; commission_types: { name: string; days: number }[] }) => {
      const ct = Array.isArray(c.commission_types) ? c.commission_types[0] : c.commission_types;
      const typeName = ct?.name;
      if (!typeName) return;
      // Keep latest
      const existing = commissions[typeName];
      if (!existing || c.commission_date > (existing.date || '')) {
        commissions[typeName] = {
          date: formatDate(c.commission_date),
          color: computeColorFromExpiry(c.expiry_date),
        };
      }
    });

    // Annual checks
    const userAnnual = annualChecksAll.filter((c: { user_id: string }) => c.user_id === user.id);
    const annualChecks: Record<string, CellData> = {};
    userAnnual.forEach((c: { check_type: string; check_date: string; expiry_date: string | null }) => {
      allAnnualCheckTypesSet.add(c.check_type);
      const existing = annualChecks[c.check_type];
      if (!existing || c.check_date > (existing.date || '')) {
        annualChecks[c.check_type] = {
          date: formatDate(c.check_date),
          color: computeColorFromExpiry(c.expiry_date),
        };
      }
    });

    // Overall
    const allColors: StatusColor[] = [
      ...Object.values(mu).flatMap(acMap => Object.values(acMap).map(c => c.color)),
      ...Object.values(lp).flatMap(acMap => Object.values(acMap).map(c => c.color)),
      ...Object.values(commissions).map(c => c.color),
      ...Object.values(annualChecks).map(c => c.color),
    ];
    const overallStatus = worstStatus(allColors);

    return { user, aircraftNames, mu, lp, commissions, annualChecks, overallStatus };
  });

  // Sort LP types by the canonical order from spreadsheet
  const LP_ORDER = ['Складний пілотаж', 'Мала висота', 'Гр. мала висота (ОНБ)', 'Бойове застосування', 'Групова злітаність', 'На десантування', 'РСНГ'];
  const lpTypes = [...allLpTypesSet].sort((a, b) => {
    const ia = LP_ORDER.indexOf(a);
    const ib = LP_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  // Sort annual checks by canonical order
  const annualCheckTypes = [...allAnnualCheckTypesSet].sort((a, b) => {
    const ia = ANNUAL_CHECK_TYPES_ORDER.indexOf(a);
    const ib = ANNUAL_CHECK_TYPES_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  // Filter commission types that exist in data
  const commissionTypes = COMMISSION_TYPES_ORDER.filter(ct =>
    pilots.some(p => p.commissions[ct])
  );

  return {
    pilots,
    allAircraftNames: [...allAircraftNamesSet].sort(),
    muTypes: MU_TYPES,
    lpTypes,
    commissionTypes,
    annualCheckTypes,
  };
}

export async function getAllPilotSummaries(): Promise<PilotSummary[]> {
  const users = await getAllPilots();
  const aircraftMap = await getAircraftTypes();

  // Fetch all data for all pilots at once
  const [
    allMuDates,
    allLpDates,
    allCommissions,
    allAnnualChecks,
    allBreaksMu,
    allBreaksLp,
    allUserAircraft,
    allKbpMappings,
  ] = await Promise.all([
    supabase.from('mu_break_dates').select('user_id, aircraft_type_id, mu_condition, last_date'),
    supabase.from('lp_break_dates').select('user_id, lp_type, last_date'),
    supabase.from('commission_dates').select('user_id, commission_date, expiry_date, commission_type_id, commission_types(name, days)'),
    supabase.from('annual_checks').select('user_id, check_type, check_date, expiry_date'),
    supabase.from('break_periods_mu').select('*'),
    supabase.from('break_periods_lp').select('*'),
    supabase.from('user_aircraft').select('user_id, aircraft_type_id'),
    supabase.from('aircraft_kbp_mapping').select('aircraft_type_id, kbp_document'),
  ]);

  const muDatesAll = allMuDates.data || [];
  const lpDatesAll = allLpDates.data || [];
  const commissionsAll = allCommissions.data || [];
  const annualChecksAll = allAnnualChecks.data || [];
  const breaksMuAll = allBreaksMu.data || [];
  const breaksLpAll = allBreaksLp.data || [];
  const userAircraftAll = allUserAircraft.data || [];
  const kbpMappingsAll = allKbpMappings.data || [];

  return users.map(user => {
    const milClass = user.military_class || 2;

    // MU allowed days
    const muAllowed: Record<string, number> = {};
    breaksMuAll
      .filter((b: { military_class: number }) => b.military_class === milClass)
      .forEach((b: { mu_condition: string; days: number }) => {
        muAllowed[b.mu_condition] = b.days;
      });

    // Aircraft names
    const userMuDates = muDatesAll.filter((m: { user_id: string }) => m.user_id === user.id);
    const acSet = new Set<string>();
    userMuDates.forEach((row: { aircraft_type_id: number }) => {
      acSet.add(aircraftMap[row.aircraft_type_id] || String(row.aircraft_type_id));
    });
    const aircraftNames = [...acSet];

    // MU statuses
    const muStatuses: StatusColor[] = [];
    MU_TYPES.forEach(muType => {
      const rows = userMuDates.filter((m: { mu_condition: string }) => m.mu_condition === muType);
      if (rows.length === 0) {
        muStatuses.push('gray');
      } else {
        const colors = rows.map((r: { last_date: string; mu_condition: string }) =>
          computeColor(r.last_date, muAllowed[r.mu_condition] || 0)
        );
        muStatuses.push(worstStatus(colors));
      }
    });

    // LP statuses
    const lpAllowed: Record<string, number> = {};
    breaksLpAll
      .filter((b: { military_class: number }) => b.military_class === milClass)
      .forEach((b: { lp_type: string; months: number }) => {
        lpAllowed[b.lp_type] = b.months;
      });

    // Get pilot's KBP docs
    const pilotAircraftIds = userAircraftAll
      .filter((ua: { user_id: string }) => ua.user_id === user.id)
      .map((ua: { aircraft_type_id: number }) => ua.aircraft_type_id);
    const pilotKbpDocs = new Set<string>();
    kbpMappingsAll.forEach((m: { aircraft_type_id: number; kbp_document: string }) => {
      if (pilotAircraftIds.includes(m.aircraft_type_id)) {
        pilotKbpDocs.add(m.kbp_document);
      }
    });

    const lpTypesSet = new Set<string>();
    breaksLpAll
      .filter((b: { military_class: number }) => b.military_class === milClass)
      .forEach((b: { lp_type: string; kbp_document: string | null }) => {
        if (!b.kbp_document || pilotKbpDocs.has(b.kbp_document)) {
          lpTypesSet.add(b.lp_type);
        }
      });

    const userLpDates = lpDatesAll.filter((l: { user_id: string }) => l.user_id === user.id);
    const lpStatuses: StatusColor[] = [];
    lpTypesSet.forEach(lpType => {
      const row = userLpDates.find((l: { lp_type: string }) => l.lp_type === lpType);
      if (!row) {
        lpStatuses.push('gray');
      } else {
        const months = lpAllowed[lpType] || 6;
        lpStatuses.push(computeColor(row.last_date, months * 30));
      }
    });

    // Commission statuses
    const userCommissions = commissionsAll.filter((c: { user_id: string }) => c.user_id === user.id);
    const commissionStatuses: StatusColor[] = [];
    userCommissions.forEach((c: { expiry_date: string | null }) => {
      commissionStatuses.push(computeColorFromExpiry(c.expiry_date));
    });

    // Annual check statuses
    const userAnnualChecks = annualChecksAll.filter((c: { user_id: string }) => c.user_id === user.id);
    const byType: Record<string, { check_date: string; expiry_date: string | null }> = {};
    userAnnualChecks.forEach((c: { check_type: string; check_date: string; expiry_date: string | null }) => {
      const existing = byType[c.check_type];
      if (!existing || new Date(c.check_date) > new Date(existing.check_date)) {
        byType[c.check_type] = c;
      }
    });
    const annualStatuses: StatusColor[] = Object.values(byType).map(c =>
      computeColorFromExpiry(c.expiry_date)
    );

    const allStatuses = [...muStatuses, ...lpStatuses, ...commissionStatuses, ...annualStatuses];
    const overallStatus = worstStatus(allStatuses);

    return {
      user,
      aircraftNames,
      muStatuses,
      lpStatuses,
      commissionStatuses,
      annualStatuses,
      overallStatus,
    };
  });
}
