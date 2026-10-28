import { Link } from "@/i18n/navigation";
import { Container } from "@/components/Container";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function BannerSection() {
  const checklist = [
    "Formations 100% en ligne",
    "Accès illimité à vie",
    "Accompagnement dédié",
    "Certificat officiel reconnu",
  ];

  return (
    <section className="py-12 md:py-16">
      <Container>
        <div className="relative overflow-hidden rounded-[20px] bg-navy-deep text-white p-8 sm:p-12 lg:p-16 shadow-lift border border-navy-deep/20">
          {/* Faint graduation cap line drawing background accent */}
          <div
            className="pointer-events-none absolute -bottom-10 -right-10 text-white/[0.04] select-none"
            aria-hidden="true"
          >
            <svg
              className="w-72 h-72 sm:w-96 sm:h-96"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 14l9-5-9-5-9 5 9 5z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 14l9-5-9-5-9 5 9 5zm0 0v6"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-orange font-bold text-xs uppercase tracking-wider border border-white/15">
              <span>Carrière & Autonomie</span>
            </div>

            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15]">
              Deviens un professionnel recherché
            </h2>

            <p className="text-base sm:text-lg text-white/80 leading-relaxed max-w-xl">
              Rejoins des milliers d&apos;Haïtiens qui développent de nouvelles compétences pratiques, lancent leur
              activité en ligne et augmentent leurs revenus grâce à Faro School.
            </p>

            {/* 4-Item Checklist with Orange Check Circles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {checklist.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange text-white shadow-orange">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="font-medium text-sm text-white/95">{item}</span>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <div className="pt-4">
              <Link href="/formations">
                <Button variant="primary" size="lg" className="text-base">
                  Commencer maintenant →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
