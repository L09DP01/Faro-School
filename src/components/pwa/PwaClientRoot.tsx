"use client";

import {PwaViewport} from "./PwaViewport";
import { ReactNode } from "react";
import { PwaProvider } from "@/lib/pwa/use-pwa";
import { PwaUpdateToast } from "./PwaUpdateToast";
import { IosInstallModal } from "./IosInstallModal";

export function PwaClientRoot({
  children,
  locale = "fr",
}: {
  children: ReactNode;
  locale?: string;
}) {
  return (
    <PwaProvider>
      <PwaViewport/>
      <div className="pwa-viewport">{children}</div>
      <PwaUpdateToast locale={locale} />
      <IosInstallModal locale={locale} />
    </PwaProvider>
  );
}
