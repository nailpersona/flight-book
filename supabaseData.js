import { supabase } from './supabase';

const MU_TYPES = ['ДПМУ', 'ДСМУ', 'ДВМП', 'НПМУ', 'НСМУ', 'НВМП'];

// Конвертує Date у рядок YYYY-MM-DD без зміщення timezone
function dateToISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Mapping: KBP normalized LP type → КЛПВ normalized LP type (by concept)
const KLPV_KBP_MAP = {
  'КБП ВА': {
    'складний_пілотаж': 'складний_вищий_пілотаж',
    'мала_висота': 'малі_висоти_клпв',
    'гмв': 'гмв_онб',
    'групова_злітаність': 'групова_злітаність_зімкнуті',
  },
  'КБП БА/РА': {
    'складний_пілотаж': 'складний_вищий_пілотаж',
    'мв_гмв_мвк': 'малі_висоти_клпв',
    'група': 'групова_злітаність_зімкнуті',
  },
};

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
    const coeff = 1.0;

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
      supabase.from('break_periods_lp').select('*').or(`military_class.eq.${milClass},military_class.is.null`),
      supabase.from('mu_break_dates').select('aircraft_type_id, mu_condition, last_date, last_control_date').eq('user_id', userId),
      supabase.from('lp_break_dates').select('lp_type, last_date, last_control_date, aircraft_type_id').eq('user_id', userId),
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
        const settings = typeof pilotSettingsRes.data.entry_settings === 'string' ? JSON.parse(pilotSettingsRes.data.entry_settings) : pilotSettingsRes.data.entry_settings;
        if (settings.aircraft_types && settings.aircraft_types.length > 0) {
          pilotAircraftTypes = settings.aircraft_types;
        }
      } catch (_) {}
    }

    // Aircraft lookup
    const aircraftMap = {};
    const aircraftNameToId = {};
    aircraftTypes.forEach(a => { aircraftMap[a.id] = a.name; aircraftNameToId[a.name] = a.id; });

    // MU allowed days (with coefficient)
    const muAllowed = {};
    breaksMu.forEach(b => {
      muAllowed[b.mu_condition] = Math.floor(b.days * coeff);
    });

    // 3. Build MU result from mu_break_dates table
    // Group by mu_condition -> array of { aircraft, date, color }
    const muByCondition = {};
    const userAircraftSet = new Set();
    muDates.forEach(row => {
      const acName = aircraftMap[row.aircraft_type_id] || String(row.aircraft_type_id);
      userAircraftSet.add(acName);
      if (!muByCondition[row.mu_condition]) muByCondition[row.mu_condition] = {};
      muByCondition[row.mu_condition][acName] = {
        last_date: row.last_date,
        last_control_date: row.last_control_date,
      };
    });

    const userAircraft = [...userAircraftSet];
    const muResult = {};
    MU_TYPES.forEach(mu => {
      const items = [];
      const acDates = muByCondition[mu] || {};
      userAircraft.forEach(acName => {
        const entry = acDates[acName] || {};
        const lastDate = entry.last_date || null;
        const lastControlDate = entry.last_control_date || null;
        const allowed = muAllowed[mu] || 0;

        // Training expiry = last_date + break_period
        let trainingExpiry = null;
        if (lastDate && allowed) {
          const exp = new Date(lastDate);
          exp.setDate(exp.getDate() + allowed);
          trainingExpiry = dateToISO(exp);
        }

        // Control expiry = last_control_date + 10 days
        let controlExpiry = null;
        if (lastControlDate) {
          const exp = new Date(lastControlDate);
          exp.setDate(exp.getDate() + 10);
          controlExpiry = dateToISO(exp);
        }

        // Effective expiry = MAX(training, control)
        let expiryDate = null;
        if (trainingExpiry && controlExpiry) {
          expiryDate = trainingExpiry > controlExpiry ? trainingExpiry : controlExpiry;
        } else {
          expiryDate = trainingExpiry || controlExpiry;
        }

        const color = expiryDate ? computeColorFromExpiry(expiryDate) : 'gray';
        items.push({
          aircraft: acName,
          date: formatDate(lastDate),
          expiryDate: formatDate(expiryDate),
          color,
        });
      });
      muResult[mu] = items;
    });

    // 4. Build LP result — grouped by KBP per pilot's aircraft

    // Map aircraft_type_id → KBP documents (excluding КЛПВ)
    const aircraftToKbp = {};
    kbpMappings.forEach(m => {
      if (m.kbp_document === 'КЛПВ') return;
      if (!aircraftToKbp[m.aircraft_type_id]) aircraftToKbp[m.aircraft_type_id] = [];
      aircraftToKbp[m.aircraft_type_id].push(m.kbp_document);
    });

    // Map normalized lp_type + aircraft_type_id → { last_date, last_control_date }
    // Nested: { lp_type: { aircraft_type_id: { last_date, last_control_date } } }
    // Old records (aircraft_type_id=null) stored under '_all' as fallback
    const lpDateMap = {};
    lpDates.forEach(row => {
      if (!lpDateMap[row.lp_type]) lpDateMap[row.lp_type] = {};
      const key = row.aircraft_type_id != null ? row.aircraft_type_id : '_all';
      lpDateMap[row.lp_type][key] = {
        last_date: row.last_date,
        last_control_date: row.last_control_date,
      };
    });

    // Get pilot's aircraft IDs (prefer user_aircraft, fallback to mu history)
    let pilotAcIds = userAircraftList.map(ua => ua.aircraft_type_id);
    if (pilotAcIds.length === 0) {
      const muAcIds = new Set();
      muDates.forEach(row => muAcIds.add(row.aircraft_type_id));
      pilotAcIds = [...muAcIds];
    }

    // Determine which KBPs pilot has + which aircraft per KBP
    // Use is_primary flag to determine primary KBP for multi-KBP aircraft
    const kbpToAircraft = {};
    const activeKbps = new Set();
    const dependentAcIds = [];

    // Build a map of aircraft_type_id -> primary KBP (using is_primary flag)
    const aircraftPrimaryKbp = {};
    kbpMappings.forEach(m => {
      if (m.kbp_document === 'КЛПВ') return;
      if (m.is_primary) {
        aircraftPrimaryKbp[m.aircraft_type_id] = m.kbp_document;
      }
    });

    pilotAcIds.forEach(acId => {
      const kbps = aircraftToKbp[acId] || [];
      const primaryKbp = aircraftPrimaryKbp[acId];

      if (kbps.length === 1) {
        const kbp = kbps[0];
        activeKbps.add(kbp);
        if (!kbpToAircraft[kbp]) kbpToAircraft[kbp] = [];
        const acName = aircraftMap[acId];
        if (acName && !kbpToAircraft[kbp].includes(acName)) {
          kbpToAircraft[kbp].push(acName);
        }
      } else if (kbps.length > 1) {
        if (primaryKbp) {
          // Use is_primary flag to determine primary KBP
          activeKbps.add(primaryKbp);
          if (!kbpToAircraft[primaryKbp]) kbpToAircraft[primaryKbp] = [];
          const acName = aircraftMap[acId];
          if (acName && !kbpToAircraft[primaryKbp].includes(acName)) {
            kbpToAircraft[primaryKbp].push(acName);
          }
        } else {
          // No primary flag — mark as dependent
          dependentAcIds.push(acId);
        }
      }
    });

    // Add dependent aircraft to KBPs activated by main aircraft
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

    // Group break_periods_lp entries by kbp_document
    // Legacy types (no kbp_document) merge into first active KBP
    const kbpOrder = ['КБП ВА', 'КБП БА/РА', 'КБПВ'];
    const firstActiveKbp = kbpOrder.find(k => kbpToAircraft[k]?.length > 0) || null;
    const lpByKbp = {};
    breaksLp.forEach(b => {
      let kbp;
      if (b.kbp_document) {
        if (!kbpToAircraft[b.kbp_document]) return; // pilot doesn't fly this KBP — skip
        kbp = b.kbp_document;
      } else {
        kbp = firstActiveKbp; // legacy (no KBP) → first active
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
    // Sort: by sort_order if available, otherwise by dates then months
    const hasAnyDate = (normalized) => {
      const m = lpDateMap[normalized];
      if (!m) return false;
      return Object.values(m).some(v => v.last_date || v.last_control_date);
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

    // Build lpSections array and flat lpResult
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
          // Per-aircraft dates, fallback to old '_all' records
          const entry = (acId && datesByAc[acId]) || datesByAc['_all'] || {};
          const lastDate = entry.last_date || null;
          const lastControlDate = entry.last_control_date || null;

          // Training expiry = last_date + break_period
          let trainingExpiry = null;
          if (lastDate && allowedDays) {
            const exp = new Date(lastDate);
            exp.setDate(exp.getDate() + allowedDays);
            trainingExpiry = dateToISO(exp);
          }

          // Control expiry = last_control_date + 10 days
          let controlExpiry = null;
          if (lastControlDate) {
            const exp = new Date(lastControlDate);
            exp.setDate(exp.getDate() + 10);
            controlExpiry = dateToISO(exp);
          }

          // Effective expiry = MAX(training, control)
          let expiryDate = null;
          if (trainingExpiry && controlExpiry) {
            expiryDate = trainingExpiry > controlExpiry ? trainingExpiry : controlExpiry;
          } else {
            expiryDate = trainingExpiry || controlExpiry;
          }

          const color = expiryDate ? computeColorFromExpiry(expiryDate) : 'gray';
          return {
            aircraft: acName,
            aircraftTypeId: acId || null,
            date: formatDate(lastDate),
            rawDate: lastDate,
            expiryDate: formatDate(expiryDate),
            color,
          };
        });

        lpSections.push({ type: 'lp', name: displayKey, normalized: cfg.normalized, kbpDoc: kbp, kbpMonths: cfg.months, items });
        lpResult[displayKey] = items;
      });
    });

    // === Conditional LP types (КБПВ) ===
    // бз_нц_прості: green if малі_висоти is valid
    // бз_нц_складні: green if BOTH малі_висоти AND складний_пілотаж_мв are valid
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

    // === КЛПВ integration ===
    // Build КЛПВ break config (raw months, no coefficient)
    const klpvBreaks = {};
    breaksLp.forEach(b => {
      if (b.kbp_document !== 'КЛПВ') return;
      if (!klpvBreaks[b.lp_type_normalized]) {
        klpvBreaks[b.lp_type_normalized] = {
          displayName: b.lp_type,
          months: b.months,
        };
      }
    });

    // Track which КЛПВ types are linked to KBP sections
    const linkedKlpvTypes = new Set();

    // Add КЛПВ expiry to matching KBP sections where months differ
    lpSections.forEach(section => {
      if (!section.kbpDoc) return;
      const mapping = KLPV_KBP_MAP[section.kbpDoc];
      if (!mapping) return;
      const klpvNorm = mapping[section.normalized];
      if (!klpvNorm) return;
      const klpvCfg = klpvBreaks[klpvNorm];
      if (!klpvCfg) return;
      linkedKlpvTypes.add(klpvNorm);
      if (klpvCfg.months === section.kbpMonths) return;
      const klpvAllowedDays = klpvCfg.months * 30;
      section.items.forEach(item => {
        if (!item.rawDate) return;
        const exp = new Date(item.rawDate);
        exp.setDate(exp.getDate() + klpvAllowedDays);
        const klpvExpiry = dateToISO(exp);
        item.klpvExpiryDate = formatDate(klpvExpiry);
        item.klpvColor = computeColorFromExpiry(klpvExpiry);
      });
      section.hasKlpv = true;
    });

    // Collect КЛПВ-only types (not mapped to any active KBP)
    // Skip КЛПВ entirely for КБПВ-only pilots (all break periods covered by КБПВ)
    const KLPV_ALWAYS_HIDE = new Set(['дозаправлення_клпв']);
    const KLPV_HELI_ONLY = new Set([
      'десантування_клпв', 'продовжений_зліт', 'посадка_самообертання',
      'пошуково_рятувальні', 'захід_макс_градієнт', 'зовнішня_підвіска_евакуація',
    ]);
    const pilotHasKbpv = activeKbps.has('КБПВ');
    const pilotOnlyKbpv = pilotHasKbpv && !activeKbps.has('КБП ВА') && !activeKbps.has('КБП БА/РА');

    const allPilotAircraft = [...new Set(Object.values(kbpToAircraft).flat())];
    const klpvOnlySections = [];
    Object.entries(klpvBreaks).forEach(([norm, cfg]) => {
      if (linkedKlpvTypes.has(norm)) return;
      if (KLPV_ALWAYS_HIDE.has(norm)) return;
      if (pilotOnlyKbpv) return;
      if (KLPV_HELI_ONLY.has(norm) && !pilotHasKbpv) return;
      const datesByAc = lpDateMap[norm] || {};
      const items = allPilotAircraft.map(acName => {
        const acId = aircraftNameToId[acName];
        const entry = (acId && datesByAc[acId]) || datesByAc['_all'] || {};
        const lastDate = entry.last_date || null;
        const allowedDays = cfg.months * 30;
        let expiryDate = null;
        if (lastDate && allowedDays) {
          const exp = new Date(lastDate);
          exp.setDate(exp.getDate() + allowedDays);
          expiryDate = dateToISO(exp);
        }
        const color = expiryDate ? computeColorFromExpiry(expiryDate) : 'gray';
        return {
          aircraft: acName,
          aircraftTypeId: acId || null,
          date: formatDate(lastDate),
          rawDate: lastDate,
          expiryDate: formatDate(expiryDate),
          color,
        };
      });
      if (items.length > 0) {
        klpvOnlySections.push({
          type: 'klpv',
          name: cfg.displayName,
          normalized: norm,
          items,
        });
      }
    });
    if (klpvOnlySections.length > 0) {
      lpSections.push({ type: 'klpv_header', name: 'Згідно КЛПВ', items: [] });
      lpSections.push(...klpvOnlySections);
    }

    const LP_TYPES = Object.keys(lpResult);

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
      return dateToISO(d);
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

    // Parse DD.MM.YYYY -> YYYY-MM-DD
    const parts = dateStr.split('.');
    if (parts.length !== 3) return { ok: false, error: 'Невірний формат дати' };
    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    // Upsert lp_break_dates (per aircraft)
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
        .update({ last_date: isoDate, aircraft_type_id: aircraftTypeId })
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
    const expiryDate = dateToISO(d);

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
    const expiryDate = dateToISO(d);

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
