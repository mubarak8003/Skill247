
"use client";

import React, { useContext, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { useRouter } from 'next/navigation';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = useContext(AppContext);
  const router = useRouter();

  useEffect(() => {
    if (context && !context.currentUser) {
      router.replace('/');
    }
  }, [context, router]);

  if (!context || !context.currentUser) {
    // You can show a loading spinner here while checking the auth status
    return (
        <div className="flex items-center justify-center min-h-screen">
            <p>Loading...</p>
        </div>
    );
  }

  return <>{children}</>;
}
