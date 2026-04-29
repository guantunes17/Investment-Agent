"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/notification-toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="min-h-screen pb-20 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <Toaster />
    </>
  );
}
