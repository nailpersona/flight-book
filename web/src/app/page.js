'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';

export default function Home() {
  const { auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth) {
      router.replace('/tabs/main');
    } else {
      router.replace('/login');
    }
  }, [auth, router]);

  return null;
}
