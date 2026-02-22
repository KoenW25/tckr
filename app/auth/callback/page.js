'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Fire-and-forget: API checks if user is new before sending
          fetch('/api/email/welcome', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).catch(() => {});
          router.replace('/dashboard');
        } else if (event === 'TOKEN_REFRESHED' && session) {
          router.replace('/dashboard');
        }
      }
    );

    const timeout = setTimeout(() => {
      router.replace('/login');
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        <p className="text-sm text-slate-500">Bezig met inloggen...</p>
      </div>
    </div>
  );
}
