import { AppShell } from "@/components/app-shell";
import React from "react";

export default function layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
