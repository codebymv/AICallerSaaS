'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to settings page - phone numbers are now managed there
export default function PhoneNumbersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings');
  }, [router]);

  return null;
}
