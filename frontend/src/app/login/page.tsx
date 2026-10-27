'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { loading, isLocal } = useAuth();

  useEffect(() => {
    if (!loading && isLocal) router.replace('/');
  }, [loading, isLocal, router]);

  if (loading || isLocal) return null;
  return <LoginForm />;
}
