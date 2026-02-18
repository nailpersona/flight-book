'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack, IoCreateOutline, IoTrashOutline, IoSunnyOutline, IoNavigateOutline, IoBookOutline, IoFlagOutline, IoFlaskOutline, IoFlameOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import s from '../../../components/shared.module.css';

function formatDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function formatFlightTime(v) {
  if (!v) return '';
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return `${String(+m[1]).padStart(2,'0')}:${m[2]}`;
  return String(v);
}

function DetailRow({ icon: Icon, label, value }) {
  if (!value || value === '-' || value === '0' || value === '00:00') return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '2px 0' }}>
      <Icon size={14} color="#9CA3AF" style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ fontSize: 13, color: '#9CA3AF', width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#111827', flex: 1 }}>{value}</span>
    </div>
  );
}

// Функція для форматування ПІБ з званням
// Примітка: name вже містить звання (наприклад "п/п-к Філенко М.М."), тому rank не додаємо
function formatNameWithRank(name, rank) {
  if (!name) return '';
  return name; // name вже містить звання
}

// Компонент для відображення екіпажу
function CrewDisplay({ crew, commanderName }) {
  // Форматуємо рядки екіпажу
  const crewLines = [];

  // Командир екіпажу (автор запису)
  if (commanderName) {
    crewLines.push({ label: 'Ком. екіпажу', name: commanderName });
  }

  // Члени екіпажу
  if (crew && crew.length > 0) {
    crew.forEach(member => {
      const memberName = member.users?.name || member.custom_name || '';
      if (memberName) {
        crewLines.push({ label: member.role, name: memberName });
      }
    });
  }

  if (crewLines.length === 0) return null;

  // Знаходимо максимальну довжину лейбла для вирівнювання
  const maxLabelLength = Math.max(...crewLines.map(l => l.label.length));

  return (
    <div style={{ textAlign: 'right', fontSize: 12 }}>
      {crewLines.map((line, idx) => (
        <div key={idx} style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <span style={{ color: '#9CA3AF' }}>{line.label}:</span>
          <span style={{ color: '#6B7280' }}>{line.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function MyRecordsPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!auth?.pib) return;
      setLoading(true);
      const { data: userData, error: userErr } = await supabase.from('users').select('id').eq('name', auth.pib).single();
      if (userErr || !userData) throw new Error('Користувача не знайдено');
      const admin = auth?.role === 'admin';
      setIsAdmin(admin);

      let query = supabase.from('flights').select(`id, date, aircraft_type_id, time_of_day, weather_conditions, flight_type, test_flight_topic, document_source, flight_time, combat_applications, flight_purpose, notes, flights_count, aircraft_types(name), fuel_records(airfield, fuel_amount), users!flights_user_id_fkey(name, rank), flight_crew(id, role, user_id, custom_name, users(name, rank))`).order('date', { ascending: false });
      if (!admin) query = query.eq('user_id', userData.id);

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (e) { window.alert(String(e.message || e)); }
    finally { setLoading(false); }
  }, [auth?.pib, auth?.role]);

  useEffect(() => { load(); }, [load]);

  const onEdit = (it) => {
    localStorage.setItem('edit_flight', JSON.stringify({ id: it.id, data: it }));
    router.push('/tabs/main');
  };

  const onDelete = async (it) => {
    if (!window.confirm('Підтвердити видалення?')) return;
    try {
      await supabase.from('flight_exercises').delete().eq('flight_id', it.id);
      await supabase.from('fuel_records').delete().eq('flight_id', it.id);
      await supabase.from('flight_updates_log').delete().eq('flight_id', it.id);
      const { error } = await supabase.from('flights').delete().eq('id', it.id);
      if (error) throw error;
      await load();
    } catch (e) { window.alert(String(e.message || e)); }
  };

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Мої записи</span>
      </div>

      {loading && items.length === 0 && <div className={s.loadingWrap}><div className={s.spinner} style={{borderTopColor:'#111827',width:24,height:24}}/></div>}

      {items.length === 0 && !loading && (
        <div className={s.loadingWrap}><IoDocumentTextOutline size={40} color="#9CA3AF" /><div className={s.emptyText}>Немає записів</div></div>
      )}

      {items.map(item => {
        const date = formatDate(item.date);
        const typePs = item.aircraft_types?.name || '';
        const pib = isAdmin ? (item.users?.name || '') : '';
        const nalit = formatFlightTime(item.flight_time);
        const pol = String(item.flights_count || '');
        const bz = String(item.combat_applications || '');
        const chas = (item.time_of_day || '') + (item.weather_conditions || '');
        const vid = item.flight_type || '';
        const docSource = item.document_source || '';
        const flightPurpose = item.flight_purpose || '';
        const testTopic = item.test_flight_topic || '';
        const fuel = item.fuel_records?.[0];
        const fuelText = fuel ? (fuel.airfield && fuel.fuel_amount ? `${fuel.airfield} — ${fuel.fuel_amount} кг` : fuel.fuel_amount ? `${fuel.fuel_amount} кг` : '') : '';

        return (
          <div key={item.id} className={s.recordCard}>
            <div className={s.recordHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: '#6B7280', borderRadius: 6, padding: '4px 10px', color: '#fff', fontSize: 13 }}>{date}</span>
                {typePs && <span style={{ fontSize: 15, color: '#111827' }}>{typePs}</span>}
              </div>
              {/* Екіпаж у правому куті */}
              <CrewDisplay
                crew={item.flight_crew}
                commanderName={isAdmin ? (item.users?.name || '') : auth?.pib}
              />
            </div>
            <div style={{ display: 'flex', background: '#F9FAFB', borderRadius: 12, padding: 12, gap: 16, marginBottom: 12 }}>
              <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 17 }}>{nalit || '00:00'}</div><div style={{ fontSize: 11, color: '#9CA3AF' }}>Наліт</div></div>
              {pol && pol !== '0' && <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 17 }}>{pol}</div><div style={{ fontSize: 11, color: '#9CA3AF' }}>Польотів</div></div>}
              {bz && bz !== '0' && <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 17 }}>{bz}</div><div style={{ fontSize: 11, color: '#9CA3AF' }}>Бой. заст.</div></div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DetailRow icon={IoSunnyOutline} label="Час доби МУ" value={chas} />
              <DetailRow icon={IoNavigateOutline} label="Вид польоту" value={vid} />
              <DetailRow icon={IoBookOutline} label="Згідно чого" value={docSource} />
              <DetailRow icon={IoFlagOutline} label="Мета польоту" value={flightPurpose} />
              <DetailRow icon={IoFlaskOutline} label="Тема випробування" value={testTopic} />
              <DetailRow icon={IoFlameOutline} label="Паливо" value={fuelText} />
            </div>
            <div className={s.recordActions}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7280' }} onClick={() => onEdit(item)}>
                <IoCreateOutline size={16} color="#111827" /><span>Редагувати</span>
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7280' }} onClick={() => onDelete(item)}>
                <IoTrashOutline size={16} color="#EF4444" /><span style={{ color: '#EF4444' }}>Видалити</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
