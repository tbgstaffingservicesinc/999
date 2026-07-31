'use client';

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

export default function UserNav() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [supabase] = useState(createClient);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    void fetchUser();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

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
