'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, isLocal } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user || isLocal ? '/explorer' : '/login');
  }, [loading, user, isLocal, router]);

  return null;
}
