"use client";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { ScanProvider } from "@/lib/scan-context";
import AppShell from "@/components/AppShell";

// Routes rendered bare — no sidebar/header, and no ScanProvider (which would
// otherwise fire session/scan requests that a signed-out visitor can't make).
const BARE_ROUTES = ["/login"];

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_ROUTES.includes(pathname);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {bare ? children : (
        <ScanProvider>
          <AppShell>{children}</AppShell>
        </ScanProvider>
      )}
    </ThemeProvider>
  );
}
