import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface DeadlineCheck {
  user_id: string;
  type: string;
  title: string;
  body: string;
  deadline_date: string;
  days_left: number;
  metadata: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Дата через 15 днів
    const in15Days = new Date(today);
    in15Days.setDate(in15Days.getDate() + 15);
    const in15DaysStr = in15Days.toISOString().split('T')[0];

    const notificationsToSend: DeadlineCheck[] = [];

    // 1. Перевірка МУ перерв (mu_break_dates + break_periods_mu)
    const { data: muBreaks } = await supabase
      .from('mu_break_dates')
      .select(`
        user_id,
        mu_condition,
        last_date,
        aircraft_type_id,
        users(name),
        aircraft_types(name)
      `);

    if (muBreaks) {
      const { data: muPeriods } = await supabase
        .from('break_periods_mu')
        .select('mu_condition, military_class, days');

      const periodMap = new Map<string, Map<number, number>>();
      muPeriods?.forEach(p => {
        if (!periodMap.has(p.mu_condition)) {
          periodMap.set(p.mu_condition, new Map());
        }
        periodMap.get(p.mu_condition)!.set(p.military_class, p.days);
      });

      // Отримати класність пілотів
      const { data: users } = await supabase
        .from('users')
        .select('id, military_class');

      const userClassMap = new Map<string, number>();
      users?.forEach(u => {
        if (u.military_class) userClassMap.set(u.id, u.military_class);
      });

      for (const mu of muBreaks) {
        if (!mu.last_date || !mu.user_id) continue;

        const militaryClass = userClassMap.get(mu.user_id) || 3;
        const days = periodMap.get(mu.mu_condition)?.get(militaryClass) || 30;

        const lastDate = new Date(mu.last_date);
        const expiryDate = new Date(lastDate);
        expiryDate.setDate(expiryDate.getDate() + days);

        const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const userName = (mu.users as any)?.name || 'Пілот';
        const aircraftName = (mu.aircraft_types as any)?.name || '';

        if (daysLeft <= 0) {
          // Термін закінчився
          notificationsToSend.push({
            user_id: mu.user_id,
            type: 'mu_expired',
            title: `Термін МУ закінчився`,
            body: `${mu.mu_condition}${aircraftName ? ` (${aircraftName})` : ''} - термін закінчився ${expiryDate.toLocaleDateString('uk-UA')}`,
            deadline_date: expiryDate.toISOString().split('T')[0],
            days_left: daysLeft,
            metadata: {
              mu_condition: mu.mu_condition,
              aircraft_type_id: mu.aircraft_type_id,
              deadline_date: expiryDate.toISOString().split('T')[0] // Для унікальності циклу
            }
          });
        } else if (daysLeft <= 15) {
          // Термін закінчується через 15 днів або менше
          notificationsToSend.push({
            user_id: mu.user_id,
            type: 'mu_warning',
            title: `Термін МУ закінчується`,
            body: `${mu.mu_condition}${aircraftName ? ` (${aircraftName})` : ''} - залишилось ${daysLeft} дн. (до ${expiryDate.toLocaleDateString('uk-UA')})`,
            deadline_date: expiryDate.toISOString().split('T')[0],
            days_left: daysLeft,
            metadata: {
              mu_condition: mu.mu_condition,
              aircraft_type_id: mu.aircraft_type_id,
              deadline_date: expiryDate.toISOString().split('T')[0] // Для унікальності циклу
            }
          });
        }
      }
    }

    // 2. Перевірка ЛП перерв (lp_break_dates + break_periods_lp)
    const { data: lpBreaks } = await supabase
      .from('lp_break_dates')
      .select(`
        user_id,
        lp_type,
        last_date,
        aircraft_type_id,
        users(name),
        aircraft_types(name)
      `);

    if (lpBreaks) {
      // Отримати періоди та повні назви з break_periods_lp
      const { data: lpPeriods } = await supabase
        .from('break_periods_lp')
        .select('lp_type, lp_type_normalized, military_class, months');

      // Мапінг: normalized -> months by class
      const lpPeriodMap = new Map<string, Map<number, number>>();
      // Мапінг: normalized -> повна назва
      const lpNameMap = new Map<string, string>();

      lpPeriods?.forEach(p => {
        const key = p.lp_type_normalized;
        if (!lpPeriodMap.has(key)) {
          lpPeriodMap.set(key, new Map());
        }
        lpPeriodMap.get(key)!.set(p.military_class || 3, p.months);
        // Зберегти повну назву (беремо першу знайдену для цього normalized)
        if (!lpNameMap.has(key) && p.lp_type) {
          lpNameMap.set(key, p.lp_type);
        }
      });

      const { data: users } = await supabase
        .from('users')
        .select('id, military_class');

      const userClassMap = new Map<string, number>();
      users?.forEach(u => {
        if (u.military_class) userClassMap.set(u.id, u.military_class);
      });

      for (const lp of lpBreaks) {
        if (!lp.last_date || !lp.user_id) continue;

        const militaryClass = userClassMap.get(lp.user_id) || 3;
        const months = lpPeriodMap.get(lp.lp_type)?.get(militaryClass) || 6;

        const lastDate = new Date(lp.last_date);
        const expiryDate = new Date(lastDate);
        expiryDate.setMonth(expiryDate.getMonth() + months);

        const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Отримати повну назву з мапінгу, або залишити як є
        const lpDisplayName = lpNameMap.get(lp.lp_type) || lp.lp_type;
        const aircraftName = (lp.aircraft_types as any)?.name || '';

        if (daysLeft <= 0) {
          notificationsToSend.push({
            user_id: lp.user_id,
            type: 'lp_expired',
            title: `Термін ЛП закінчився`,
            body: `${lpDisplayName}${aircraftName ? ` (${aircraftName})` : ''} - термін закінчився ${expiryDate.toLocaleDateString('uk-UA')}`,
            deadline_date: expiryDate.toISOString().split('T')[0],
            days_left: daysLeft,
            metadata: {
              lp_type: lp.lp_type,
              aircraft_type_id: lp.aircraft_type_id,
              deadline_date: expiryDate.toISOString().split('T')[0]
            }
          });
        } else if (daysLeft <= 15) {
          notificationsToSend.push({
            user_id: lp.user_id,
            type: 'lp_warning',
            title: `Термін ЛП закінчується`,
            body: `${lpDisplayName}${aircraftName ? ` (${aircraftName})` : ''} - залишилось ${daysLeft} дн. (до ${expiryDate.toLocaleDateString('uk-UA')})`,
            deadline_date: expiryDate.toISOString().split('T')[0],
            days_left: daysLeft,
            metadata: {
              lp_type: lp.lp_type,
              aircraft_type_id: lp.aircraft_type_id,
              deadline_date: expiryDate.toISOString().split('T')[0]
            }
          });
        }
      }
    }

    // 3. Перевірка комісій (commission_dates)
    const { data: commissions } = await supabase
      .from('commission_dates')
      .select(`
        user_id,
        commission_date,
        expiry_date,
        commission_type_id,
        commission_types(name),
        users(name)
      `);

    if (commissions) {
      for (const c of commissions) {
        if (!c.user_id) continue;

        const expiryDate = c.expiry_date ? new Date(c.expiry_date) : null;
        if (!expiryDate) continue;

        const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const commName = (c.commission_types as any)?.name || 'Комісія';

        if (daysLeft <= 0) {
          notificationsToSend.push({
            user_id: c.user_id,
            type: 'commission_expired',
            title: `Термін комісії закінчився`,
            body: `${commName} - термін закінчився ${expiryDate.toLocaleDateString('uk-UA')}`,
            deadline_date: expiryDate.toISOString().split('T')[0],
            days_left: daysLeft,
            metadata: {
              commission_type_id: c.commission_type_id,
              deadline_date: expiryDate.toISOString().split('T')[0]
            }
          });
        } else if (daysLeft <= 15) {
          notificationsToSend.push({
            user_id: c.user_id,
            type: 'commission_warning',
            title: `Термін комісії закінчується`,
            body: `${commName} - залишилось ${daysLeft} дн. (до ${expiryDate.toLocaleDateString('uk-UA')})`,
            deadline_date: expiryDate.toISOString().split('T')[0],
            days_left: daysLeft,
            metadata: {
              commission_type_id: c.commission_type_id,
              deadline_date: expiryDate.toISOString().split('T')[0]
            }
          });
        }
      }
    }

    // 4. Перевірка річних перевірок (annual_checks)
    const { data: checks } = await supabase
      .from('annual_checks')
      .select(`
        user_id,
        check_type,
        expiry_date,
        users(name)
      `);

    if (checks) {
      for (const ch of checks) {
        if (!ch.user_id || !ch.expiry_date) continue;

        const expiryDate = new Date(ch.expiry_date);
        const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft <= 0) {
          notificationsToSend.push({
            user_id: ch.user_id,
            type: 'check_expired',
            title: `Термін перевірки закінчився`,
            body: `${ch.check_type} - термін закінчився ${expiryDate.toLocaleDateString('uk-UA')}`,
            deadline_date: expiryDate.toISOString().split('T')[0],
            days_left: daysLeft,
            metadata: {
              check_type: ch.check_type,
              deadline_date: expiryDate.toISOString().split('T')[0]
            }
          });
        } else if (daysLeft <= 15) {
          notificationsToSend.push({
            user_id: ch.user_id,
            type: 'check_warning',
            title: `Термін перевірки закінчується`,
            body: `${ch.check_type} - залишилось ${daysLeft} дн. (до ${expiryDate.toLocaleDateString('uk-UA')})`,
            deadline_date: expiryDate.toISOString().split('T')[0],
            days_left: daysLeft,
            metadata: {
              check_type: ch.check_type,
              deadline_date: expiryDate.toISOString().split('T')[0]
            }
          });
        }
      }
    }

    // Надсилати повідомлення тільки один раз для кожного події:
    // - warning: коли термін вперше стає <= 15 днів
    // - expired: коли термін вперше закінчується
    // Перевіряємо чи ВЖЕ було надіслано таке повідомлення (без обмеження часом)
    const sentCount = { new: 0, duplicate: 0 };

    for (const n of notificationsToSend) {
      // Перевірити чи вже є таке повідомлення (будь-коли, не тільки за останні 7 днів)
      // Використовуємо deadline_date та metadata для точного порівняння
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', n.user_id)
        .eq('type', n.type)
        .contains('metadata', n.metadata as any);

      if (!existing || existing.length === 0) {
        // Створити нове повідомлення
        await supabase
          .from('notifications')
          .insert({
            user_id: n.user_id,
            title: n.title,
            body: n.body,
            type: n.type,
            metadata: n.metadata
          });
        sentCount.new++;
      } else {
        sentCount.duplicate++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      checked: {
        mu: muBreaks?.length || 0,
        lp: lpBreaks?.length || 0,
        commissions: commissions?.length || 0,
        checks: checks?.length || 0
      },
      notifications: sentCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
