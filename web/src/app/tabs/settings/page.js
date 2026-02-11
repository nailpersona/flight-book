'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoChevronBack } from 'react-icons/io5';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import s from '../../../components/shared.module.css';

export default function SettingsPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [aircraftTypes, setAircraftTypes] = useState('');
  const [sources, setSources] = useState('');
  const [saving, setSaving] = useState(false);
  const [allAircraftTypes, setAllAircraftTypes] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: types } = await supabase.from('aircraft_types').select('name').order('name');
      setAllAircraftTypes((types || []).map(t => t.name));

      if (auth?.email) {
        const { data: pilot } = await supabase.from('pilots').select('entry_settings').eq('email', auth.email).maybeSingle();
        if (pilot?.entry_settings) {
          const parsed = typeof pilot.entry_settings === 'string' ? JSON.parse(pilot.entry_settings) : pilot.entry_settings;
          if (parsed.aircraft_types) setAircraftTypes(parsed.aircraft_types.join(', '));
          if (parsed.sources) setSources(parsed.sources.join(', '));
        }
      }
    })();
  }, [auth?.email]);

  const save = async () => {
    try {
      setSaving(true);
      const settings = {
        aircraft_types: aircraftTypes.split(',').map(s => s.trim()).filter(Boolean),
        sources: sources.split(',').map(s => s.trim()).filter(Boolean),
      };
      const { error } = await supabase.from('pilots').update({ entry_settings: JSON.stringify(settings) }).eq('email', auth.email);
      if (error) throw error;
      window.alert('Збережено');
    } catch (err) {
      window.alert(String(err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.topBarBack} onClick={() => router.push('/tabs/profile')}><IoChevronBack size={20} /></button>
        <span className={s.topBarTitle}>Налаштування</span>
      </div>

      <div className={s.card}>
        <div className={s.label}>Типи ПС (через кому)</div>
        <input className={s.input} value={aircraftTypes} onChange={e => setAircraftTypes(e.target.value)} placeholder="МіГ-29, Су-27, Л-39" style={{ marginBottom: 16 }} />

        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
          Доступні: {allAircraftTypes.join(', ')}
        </div>

        <div className={s.label}>Документи (через кому)</div>
        <input className={s.input} value={sources} onChange={e => setSources(e.target.value)} placeholder="КБП ВА, КЛПВ" style={{ marginBottom: 16 }} />

        <button className={`${s.btn} ${s.btnPrimary}`} onClick={save} disabled={saving} style={{ width: '100%' }}>
          {saving ? <div className={s.spinner} /> : 'Зберегти'}
        </button>
      </div>
    </div>
  );
}
