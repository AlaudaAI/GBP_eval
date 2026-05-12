import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { TokenGate } from "@/components/TokenGate";
import { Sidebar } from "@/components/Sidebar";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";

export const metadata: Metadata = {
  title: "Alauda AI — GBP audit",
  description: "Google Business Profile audit and action plan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <WorkspaceProvider>
          <TokenGate>
            <header className="border-b border-slate-200 bg-white print:hidden">
              <div className="flex items-center justify-between px-4 h-14">
                <Link href="/" className="flex items-center gap-2">
                  <Image src="/logo.png" alt="Alauda AI" width={28} height={28} />
                  <span className="font-semibold text-slate-900">Alauda AI</span>
                </Link>
                <div className="flex items-center gap-3">
                  <ProjectSwitcher />
                  <Link
                    href="/settings"
                    className="text-sm text-slate-700 hover:text-slate-900"
                  >
                    Settings
                  </Link>
                </div>
              </div>
            </header>
            <div className="flex">
              <Sidebar />
              <main className="flex-1 max-w-5xl px-4 md:px-8 py-6">{children}</main>
            </div>
          </TokenGate>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
