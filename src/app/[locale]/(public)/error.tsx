"use client";

import { Container, ErrorState } from "@/components";
import { useTranslations } from "next-intl";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  return (
    <div className="py-16">
      <Container>
        <ErrorState
          title={t("error")}
          message={error.message || "Une erreur inattendue est survenue."}
          onRetry={reset}
        />
      </Container>
    </div>
  );
}
