import { Container } from "@/components/Container";
import { UserPlus, BookCheck, PlayCircle, Award, ChevronRight } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      num: "1",
      title: "Crée un compte",
      desc: "Inscris-toi gratuitement en quelques secondes avec ton email ou ton téléphone.",
      icon: <UserPlus className="w-5 h-5 text-orange" />,
    },
    {
      num: "2",
      title: "Choisis une formation",
      desc: "Découvre nos cours pratiques et règle facilement en gourdes par MonCash ou NatCash.",
      icon: <BookCheck className="w-5 h-5 text-orange" />,
    },
    {
      num: "3",
      title: "Apprends à ton rythme",
      desc: "Regarde les vidéos HD optimisées pour smartphone, où et quand tu veux.",
      icon: <PlayCircle className="w-5 h-5 text-orange" />,
    },
    {
      num: "4",
      title: "Obtiens ton certificat",
      desc: "Termine les modules et télécharge ton certificat officiel reconnu avec code de vérification.",
      icon: <Award className="w-5 h-5 text-orange" />,
    },
  ];

  return (
    <section className="py-14 md:py-20 bg-bg">
      <Container className="space-y-12">
        {/* Title Header */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-orange">
            Simple, rapide et adapté
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Comment ça marche ?
          </h2>
          <p className="text-sm text-muted-faro">
            4 étapes simples pour commencer à te former dès aujourd&apos;hui sur Faro School.
          </p>
        </div>

        {/* Steps Grid / Timeline */}
        <div className="relative">
          {/* Mobile Dotted Connecting Line */}
          <div
            className="md:hidden absolute top-8 bottom-8 left-[27px] w-0.5 border-l-2 border-dotted border-orange/40 z-0"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 relative z-10">
            {steps.map((step, idx) => (
              <div key={step.num} className="relative flex flex-col items-start md:items-center text-left md:text-center group">
                {/* Desktop Chevron connector between cards */}
                {idx < steps.length - 1 && (
                  <div
                    className="hidden md:flex absolute top-7 -right-3 text-muted-faro/40 z-20 pointer-events-none"
                    aria-hidden="true"
                  >
                    <ChevronRight className="w-6 h-6 stroke-[2]" />
                  </div>
                )}

                {/* Step Top: Circle Number + Icon */}
                <div className="flex items-center gap-4 md:flex-col md:gap-3 mb-4">
                  <div className="relative">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface border border-line shadow-card group-hover:border-orange/40 transition-colors">
                      {step.icon}
                    </div>
                    {/* Orange Number Badge */}
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange text-white font-heading font-bold text-xs shadow-orange">
                      {step.num}
                    </span>
                  </div>
                </div>

                {/* Step Content */}
                <div className="space-y-1.5 pl-18 md:pl-0">
                  <h3 className="font-heading text-base font-bold text-ink">
                    {step.title}
                  </h3>
                  <p className="text-xs text-muted-faro leading-relaxed max-w-xs">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
