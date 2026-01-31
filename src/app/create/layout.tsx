import type { ReactNode } from "react";

import AppSidebar from "@/components/app-sidebar";

export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F6F8FC] font-sans text-[#0E121B]">
      <div className="mx-auto flex w-full md:max-w-[90rem]">
        <AppSidebar />
        <main className="flex min-h-[100dvh] w-full flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
