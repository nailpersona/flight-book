'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPilotDashboard } from '@/lib/data';
import { PilotDashboardData } from '@/lib/types';
import PilotHeader from '@/components/PilotHeader';
import MuBreaksTable from '@/components/MuBreaksTable';
import LpBreaksTable from '@/components/LpBreaksTable';
import CommissionsTable from '@/components/CommissionsTable';
import AnnualChecksTable from '@/components/AnnualChecksTable';
import FlightHoursSummary from '@/components/FlightHoursSummary';

export default function PilotDetailPage() {
  const params = useParams();
  const pilotId = params.pilotId as string;

  const [data, setData] = useState<PilotDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pilotId) return;
    getPilotDashboard(pilotId)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [pilotId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Завантаження...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-error">{error || 'Дані не знайдено'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-secondary">
      <PilotHeader user={data.user} />

      <main className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
        <MuBreaksTable mu={data.mu} aircraftNames={data.aircraftNames} />
        <LpBreaksTable lp={data.lp} lpTypes={data.lpTypes} />
        <CommissionsTable commission={data.commission} />
        <AnnualChecksTable checks={data.annualChecks} />
        <FlightHoursSummary rows={data.flightHours} />
      </main>
    </div>
  );
}
