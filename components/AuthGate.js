'use client';

import Navbar from '@/components/Navbar';

export default function AuthGate({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
