import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface TrainingPlannerRequest {
  user_id: string;
  aircraft_type: 'Су-27' | 'МіГ-29' | 'Л-39';
  target_mu: string[];
  target_lp: string[];
}

interface FlightPlanItem {
  exercise_id: number;
  number: string;
  name: string;
  lp_types: string[];
  flights_count: number;
  is_control: boolean;
  restores: string[]; // Що відновлює ця вправа
  complexes_with: string[]; // З чим можна комплексувати
}

interface BreakStatus {
  type: string; // ЛП або МУ
  name: string;
  last_flight: string | null;
  break_allowed_days: number;
  expires_on: string | null;
  days_expired: number; // Скільки днів як випав (від'ємне = ще дійсний)
  status: number; // 2=valid, 1=warning, 0=expired
}

interface TrainingPlanResponse {
  plan: {
    flights: FlightPlanItem[];
    total_flights: number;
    estimated_shifts: number;
    complexing_opportunities: string[];
  };
  recommendations: string;
  breaks_status: BreakStatus[];
}

const SYSTEM_PROMPT = `Ти — досвідчений льотчик-інструктор винищувальної авіації.

ЗАВДАННЯ: Скласти МІНІМАЛЬНИЙ план відновлення навичок.

КРИТИЧНІ ПРАВИЛА:
1. Для кожного простроченого ЛП: ОДИН контрольний + ОДИН тренувальний
2. НЕ перераховувати всі вправи — тільки конкретні для відновлення
3. Показати які вправи можна комплексувати в одному вильоті
4. Вказати кількість льотних змін реалістично

Формат відповіді:
## Аналіз поточного стану
[Які ЛП/МУ прострочені, на скільки]

## План відновлення
[Конкретні вправи для кожного простроченого ЛП/МУ]

## Комплексування
[Які вправи можна об'єднати в одному вильоті]

## Льотні зміни
[Оцінка кількості змін]`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  const jsonResponse = (data: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  try {
    const body: TrainingPlannerRequest = await req.json();
    const { user_id, aircraft_type, target_mu, target_lp } = body;

    if (!user_id || !aircraft_type) {
      return jsonResponse({ error: "user_id та aircraft_type обов'язкові" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user data
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, military_class")
      .eq("id", user_id)
      .single();

    if (userError || !user) {
      return jsonResponse({ error: "Користувача не знайдено" }, 404);
    }

    const pilotClass = user.military_class || 3;

    // Get break periods
    const { data: lpBreakPeriods } = await supabase
      .from("break_periods_lp")
      .select("lp_type_normalized, months")
      .eq("kbp_document", "КБП ВА")
      .eq("military_class", pilotClass);

    const { data: muBreakPeriods } = await supabase
      .from("break_periods_mu")
      .select("mu_condition, days")
      .eq("military_class", pilotClass);

    // Get last flight dates
    const { data: lpBreaks } = await supabase
      .from("lp_break_dates")
      .select("lp_type, last_date")
      .eq("user_id", user_id);

    const { data: muBreaks } = await supabase
      .from("mu_break_dates")
      .select("mu_condition, last_date")
      .eq("user_id", user_id);

    // Build maps
    const lpPeriodMap = new Map((lpBreakPeriods || []).map(b => [b.lp_type_normalized, b.months * 30]));
    const muPeriodMap = new Map((muBreakPeriods || []).map(b => [b.mu_condition, b.days]));
    const lpLastFlightMap = new Map((lpBreaks || []).map(b => [b.lp_type, b.last_date]));
    const muLastFlightMap = new Map((muBreaks || []).map(b => [b.mu_condition, b.last_date]));

    // Calculate break status
    const breaksStatus: BreakStatus[] = [];
    const expiredLPs: string[] = [];
    const expiredMUs: string[] = [];

    // LP status
    for (const lpType of target_lp) {
      const lastFlight = lpLastFlightMap.get(lpType);
      const breakAllowed = lpPeriodMap.get(lpType) || 180; // default 6 months

      let expiresOn: string | null = null;
      let daysExpired = 0;
      let status = 0;

      if (lastFlight) {
        const lastDate = new Date(lastFlight);
        const expireDate = new Date(lastDate.getTime() + breakAllowed * 24 * 60 * 60 * 1000);
        expiresOn = expireDate.toISOString().split('T')[0];
        daysExpired = Math.floor((Date.now() - expireDate.getTime()) / (1000 * 60 * 60 * 24));
        status = daysExpired > 15 ? 0 : daysExpired > 0 ? 1 : 2;
      } else {
        daysExpired = 999;
        status = 0;
      }

      if (status === 0) expiredLPs.push(lpType);

      breaksStatus.push({
        type: 'ЛП',
        name: lpType,
        last_flight: lastFlight || null,
        break_allowed_days: breakAllowed,
        expires_on: expiresOn,
        days_expired: daysExpired,
        status
      });
    }

    // MU status
    for (const mu of target_mu) {
      const lastFlight = muLastFlightMap.get(mu);
      const breakAllowed = muPeriodMap.get(mu) || 77;

      let expiresOn: string | null = null;
      let daysExpired = 0;
      let status = 0;

      if (lastFlight) {
        const lastDate = new Date(lastFlight);
        const expireDate = new Date(lastDate.getTime() + breakAllowed * 24 * 60 * 60 * 1000);
        expiresOn = expireDate.toISOString().split('T')[0];
        daysExpired = Math.floor((Date.now() - expireDate.getTime()) / (1000 * 60 * 60 * 24));
        status = daysExpired > 15 ? 0 : daysExpired > 0 ? 1 : 2;
      } else {
        daysExpired = 999;
        status = 0;
      }

      if (status === 0) expiredMUs.push(mu);

      breaksStatus.push({
        type: 'МУ',
        name: mu,
        last_flight: lastFlight || null,
        break_allowed_days: breakAllowed,
        expires_on: expiresOn,
        days_expired: daysExpired,
        status
      });
    }

    // Get exercises for restoration
    const { data: controlExercises } = await supabase
      .from("exercises")
      .select("id, number, name, lp_types, flights_count, is_control")
      .eq("document", "КБП ВА")
      .eq("is_control", true)
      .overlaps("lp_types", expiredLPs)
      .order("number");

    const { data: trainingExercises } = await supabase
      .from("exercises")
      .select("id, number, name, lp_types, flights_count, is_control")
      .eq("document", "КБП ВА")
      .eq("is_control", false)
      .overlaps("lp_types", expiredLPs)
      .order("number");

    // Build minimal plan - ONE control + ONE training per expired LP
    const planFlights: FlightPlanItem[] = [];
    const usedLPs = new Set<string>();
    const complexingOpportunities: string[] = [];

    // Add control flights
    for (const e of (controlExercises || [])) {
      const primaryLP = (e.lp_types || [])[0];
      if (primaryLP && !usedLPs.has(primaryLP) && expiredLPs.includes(primaryLP)) {
        const otherLPs = (e.lp_types || []).filter(lp => lp !== primaryLP && expiredLPs.includes(lp));

        planFlights.push({
          exercise_id: e.id,
          number: e.number,
          name: e.name,
          lp_types: e.lp_types || [],
          flights_count: 1,
          is_control: true,
          restores: [primaryLP, ...otherLPs],
          complexes_with: []
        });

        if (otherLPs.length > 0) {
          complexingOpportunities.push(`Вправа ${e.number} одночасно відновлює: ${[primaryLP, ...otherLPs].join(', ')}`);
        }

        usedLPs.add(primaryLP);
      }
    }

    // Add training flights
    for (const e of (trainingExercises || [])) {
      const primaryLP = (e.lp_types || [])[0];
      if (primaryLP && expiredLPs.includes(primaryLP) && planFlights.filter(f => !f.is_control).length < 5) {
        planFlights.push({
          exercise_id: e.id,
          number: e.number,
          name: e.name,
          lp_types: e.lp_types || [],
          flights_count: parseInt(e.flights_count) || 1,
          is_control: false,
          restores: e.lp_types || [],
          complexes_with: []
        });
      }
    }

    // Add MU restoration flights (28/29)
    if (expiredMUs.length > 0) {
      planFlights.push({
        exercise_id: 31,
        number: '28(2)',
        name: 'Контрольний політ у хмарах',
        lp_types: [],
        flights_count: 1,
        is_control: true,
        restores: expiredMUs,
        complexes_with: []
      });
      planFlights.push({
        exercise_id: 32,
        number: '29(2)',
        name: 'Політ у хмарах з заходом на посадку',
        lp_types: [],
        flights_count: 1,
        is_control: false,
        restores: expiredMUs,
        complexes_with: []
      });
      complexingOpportunities.push(`Для відновлення МУ: вправи 28(2) та 29(2) виконуються у фактичних погодних умовах`);
    }

    // Get AI recommendations
    const breaksSummary = breaksStatus.map(b => {
      const icon = b.status === 2 ? '✅' : b.status === 1 ? '⚠️' : '❌';
      if (b.status === 0) {
        return `- ${b.type} "${b.name}": ${icon} ВИПАВ ${b.days_expired} дн. тому (ост. політ ${b.last_flight}, термін ${b.break_allowed_days} дн.)`;
      } else {
        return `- ${b.type} "${b.name}": ${icon} дійсний до ${b.expires_on}`;
      }
    }).join('\n');

    const planSummary = planFlights.map(f =>
      `- ${f.number}: ${f.name} [${f.is_control ? 'КОНТРОЛЬНИЙ' : 'ТРЕНУВАЛЬНИЙ'}] → відновлює: ${f.restores.join(', ')}`
    ).join('\n');

    const promptContent = `Льотчик: ${user.name}
Клас: ${pilotClass}
Літак: ${aircraft_type}

СТАН ПЕРЕРВ:
${breaksSummary}

ПЛАН ВІДНОВЛЕННЯ:
${planSummary}

МОЖЛИВОСТІ КОМПЛЕКСУВАННЯ:
${complexingOpportunities.join('\n') || 'Немає'}

Дай стислі рекомендації по плану відновлення.`;

    // Call GPT-4o
    let recommendations = "";
    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.3,
        max_tokens: 1500,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: promptContent }],
      }),
    });

    if (chatRes.ok) {
      const chatData = await chatRes.json();
      recommendations = chatData.choices[0].message.content;
    } else {
      recommendations = "Не вдалося згенерувати рекомендації";
    }

    const totalFlights = planFlights.length;
    const flightsPerShift = pilotClass === 3 ? 4 : 5;

    return jsonResponse({
      plan: {
        flights: planFlights,
        total_flights: totalFlights,
        estimated_shifts: Math.max(1, Math.ceil(totalFlights / flightsPerShift)),
        complexing_opportunities: complexingOpportunities
      },
      recommendations: `[gpt-4o]\n\n${recommendations}`,
      breaks_status: breaksStatus
    });

  } catch (err) {
    console.error("Exception:", (err as Error).message);
    return jsonResponse({ error: "Внутрішня помилка: " + (err as Error).message }, 500);
  }
});
