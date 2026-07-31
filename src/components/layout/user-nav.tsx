'use client';

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';

export default function UserNav() {
  const [user, setUser] = useState<User | null>(null);
  const [configurationError, setConfigurationError] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

useEffect(() => {
    try {
      const supabase = createClient();
      supabaseRef.current = supabase;
      void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    } catch {
      setConfigurationError(true);
    }
  }, []);

  const handleLogout = async () => {
    const supabase = supabaseRef.current ?? createClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  if (configurationError) {
    return <span role="status" className="text-sm text-amber-700">Authentication is not configured</span>;
  }
  if (!user && pathname === '/login') {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      {user ? (
        <>
          <span className="text-sm text-gray-500">{user.email}</span>
          <Button type="button" onClick={handleLogout} variant="ghost">Logout</Button>
        </>
      ) : (
        <Button type="button" onClick={() => router.push('/login')} variant="ghost">Login</Button>
      )}
    </div>
  );
}



