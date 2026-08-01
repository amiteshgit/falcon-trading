"use client";
import { ThemeProvider } from "next-themes";
import { ScanProvider } from "@/lib/scan-context";
import AppShell from "@/components/AppShell";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ScanProvider>
        <AppShell>{children}</AppShell>
      </ScanProvider>
    </ThemeProvider>
  );
}
