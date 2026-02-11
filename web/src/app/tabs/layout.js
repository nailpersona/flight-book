'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import TabBar from '../../components/TabBar';

export default function TabsLayout({ children }) {
  const { auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth) {
      router.replace('/login');
    }
  }, [auth, router]);

  if (!auth) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6' }}>
      <TabBar />
      <main>{children}</main>
    </div>
  );
}
