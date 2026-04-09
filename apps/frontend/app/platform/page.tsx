'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatformAuthStore } from '@/store/platform-auth.store';

export default function PlatformPage() {
  const router = useRouter();
  const platformToken = usePlatformAuthStore((s) => s.platformToken);

  useEffect(() => {
    router.replace(platformToken ? '/platform/dashboard' : '/platform/login');
  }, [platformToken, router]);

  return null;
}
