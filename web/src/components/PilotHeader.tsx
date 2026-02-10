import { User } from '@/lib/types';

export default function PilotHeader({ user }: { user: User }) {
  return (
    <div className="bg-bg-primary border-b border-border px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-xl text-text-primary">{user.name}</h1>
          <div className="text-sm text-text-secondary mt-1 flex gap-3 flex-wrap">
            {user.rank && <span>{user.rank}</span>}
            {user.position && <span>{user.position}</span>}
            <span>Класність: {user.military_class || '—'}</span>
          </div>
        </div>
        <a href="/dashboard" className="text-accent text-sm no-underline hover:text-primary">
          ← Назад
        </a>
      </div>
    </div>
  );
}
