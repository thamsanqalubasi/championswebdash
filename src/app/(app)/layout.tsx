import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

export default function DesktopLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
