"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/Container";
import { Star, ChevronLeft, ChevronRight, ChevronDown, MessageSquareQuote } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReviewItem {
  id: string;
  name: string;
  role?: string;
  city?: string;
  courseTitle: string;
  rating: number;
  comment: string;
}

interface TestimonialsAndFaqSectionProps {
  reviews?: ReviewItem[];
}

export function TestimonialsAndFaqSection({ reviews = [] }: TestimonialsAndFaqSectionProps) {
  // Fallbacks if database has 0 reviews
  const defaultReviews: ReviewItem[] = [
    {
      id: "rev-1",
      name: "Jean-Marc Pierre",
      role: "Freelance & Développeur",
      city: "Port-au-Prince",
      courseTitle: "Développement Web Moderne",
      rating: 5,
      comment:
        "Faro School a changé ma vie professionnelle. J'ai pu payer facilement avec mon compte MonCash et suivre les vidéos le soir après le travail. Aujourd'hui, je décroche mes premiers contrats clients !",
    },
    {
      id: "rev-2",
      name: "Lourdes Saint-Fleur",
      role: "Commerçante en ligne",
      city: "Cap-Haïtien",
      courseTitle: "Marketing Digital & Vente",
      rating: 5,
      comment:
        "Les explications sont simples, directes et adaptées aux réalités de notre pays. Le paiement NatCash a été instantané et le certificat m'a donné beaucoup de crédibilité auprès de mes partenaires.",
    },
    {
      id: "rev-3",
      name: "Samuel Desrosiers",
      role: "Comptable junior",
      city: "Delmas",
      courseTitle: "Bureautique & Excel Pro",
      rating: 5,
      comment:
        "La qualité des vidéos est incroyable et ça ne consomme presque rien sur mon forfait mobile. Je recommande Faro School à tous les jeunes d'Haïti qui veulent progresser rapidement.",
    },
  ];

  const testimonialItems = reviews.length > 0 ? reviews : defaultReviews;
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const prevTestimonial = () => {
    setCurrentTestimonial((curr) => (curr === 0 ? testimonialItems.length - 1 : curr - 1));
  };

  const nextTestimonial = () => {
    setCurrentTestimonial((curr) => (curr === testimonialItems.length - 1 ? 0 : curr + 1));
  };

  const activeReview = testimonialItems[currentTestimonial];

  // 5 FAQ Items covering local payments, duration, certificates, mobile, refund
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "Comment payer avec MonCash ou NatCash ?",
      a: "Lors de la commande, choisis MonCash ou NatCash. Tu es redirigé vers l'interface de paiement sécurisée Kobara pour confirmer la transaction en gourdes. Ton accès à la formation est activé automatiquement dans la seconde !",
    },
    {
      q: "Pendant combien de temps ai-je accès aux cours ?",
      a: "Tu bénéficies d'un accès illimité à vie ! Tu peux revoir les leçons, poser des questions et télécharger les ressources pédagogiques à tout moment, 24h/24 et 7j/7.",
    },
    {
      q: "Le certificat est-il reconnu et vérifiable ?",
      a: "Oui. Dès que tu termines 100% des modules de ta formation, un certificat officiel Faro School est généré avec un identifiant unique et un QR code vérifiable en ligne.",
    },
    {
      q: "Puis-je suivre les cours sur mon téléphone portable ?",
      a: "Absolument ! Toute la plateforme Faro School est pensée mobile-first. Les vidéos s'adaptent automatiquement à ta connexion pour t'offrir une lecture fluide sans gaspiller tes données Internet.",
    },
    {
      q: "Quelle est la politique de remboursement ?",
      a: "Toutes nos formations bénéficient d'une garantie satisfait ou remboursé de 7 jours. Si le cours ne répond pas à tes attentes, contacte notre support et tu seras remboursé sans tracas.",
    },
  ];

  return (
    <section className="py-14 md:py-20 bg-bg">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">
          {/* LEFT COLUMN: Testimonials Carousel (lg:col-span-6) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-orange">
                Témoignages
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                Ce que disent nos apprenants
              </h2>
              <p className="text-sm text-muted-faro">
                Des retours authentiques d&apos;étudiants qui transforment leur carrière avec nous.
              </p>
            </div>

            {/* Testimonial Card */}
            <div className="relative rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-card flex flex-col justify-between min-h-[300px]">
              <div className="space-y-4">
                {/* Header: Stars + Quote Icon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-orange gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-4 h-4",
                          i < activeReview.rating ? "fill-orange text-orange" : "text-line"
                        )}
                      />
                    ))}
                  </div>
                  <MessageSquareQuote className="w-8 h-8 text-orange-tint" />
                </div>

                {/* Quote */}
                <p className="font-sans text-sm sm:text-base text-ink italic leading-relaxed">
                  &ldquo;{activeReview.comment}&rdquo;
                </p>
              </div>

              {/* Author & Controls Row */}
              <div className="pt-6 mt-4 border-t border-line flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-tint text-orange font-heading font-bold text-sm border border-orange/20">
                    {activeReview.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div>
                    <h3 className="font-heading text-sm font-bold text-ink leading-tight">
                      {activeReview.name}
                    </h3>
                    <p className="text-xs text-muted-faro">
                      {activeReview.role || "Étudiant Faro"}
                      {activeReview.city ? ` • ${activeReview.city}` : ""}
                    </p>
                  </div>
                </div>

                {/* Prev / Next Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={prevTestimonial}
                    aria-label="Témoignage précédent"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-bg text-ink hover:bg-orange-tint hover:text-orange transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <button
                    type="button"
                    onClick={nextTestimonial}
                    aria-label="Témoignage suivant"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-bg text-ink hover:bg-orange-tint hover:text-orange transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* Mobile Dots */}
              <div className="flex items-center justify-center gap-1.5 pt-4 sm:hidden">
                {testimonialItems.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentTestimonial(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      currentTestimonial === i ? "w-5 bg-orange" : "w-1.5 bg-line"
                    )}
                    aria-label={`Aller au témoignage ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: FAQ Accordion (lg:col-span-6) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-orange">
                  FAQ
                </span>
                <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                  Questions fréquentes
                </h2>
              </div>
              <Link
                href="/contact"
                className="text-xs font-semibold text-blue underline underline-offset-4 hover:text-blue/80 transition-colors"
              >
                Voir la FAQ complète →
              </Link>
            </div>

            {/* Accordion Rows */}
            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-line bg-surface overflow-hidden transition-all shadow-subtle"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-heading text-sm sm:text-base font-bold text-ink hover:text-orange-strong transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span className="pr-4">{faq.q}</span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 shrink-0 text-muted-faro transition-transform duration-200",
                          isOpen && "rotate-180 text-orange"
                        )}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-muted-faro leading-relaxed border-t border-line/60 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
