"use client";

import { useState } from "react";
import { Container } from "@/components/Container";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Veuillez renseigner une adresse email valide.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, hp: honeypot, locale: "fr" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Une erreur est survenue.");
      }

      setStatus("success");
      setMessage("Merci ! Tu es bien inscrit(e) à notre newsletter.");
      setEmail("");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Impossible de vous inscrire pour le moment.");
    }
  };

  return (
    <section className="py-10 md:py-14 bg-bg">
      <Container>
        <div className="rounded-[20px] bg-orange-tint/70 border border-orange/25 p-6 sm:p-10 lg:p-12 shadow-subtle">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Left Header */}
            <div className="lg:col-span-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange text-white shadow-orange">
                <Mail className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading text-xl sm:text-2xl font-black text-ink">
                  Reste informé(e)
                </h3>
                <p className="text-xs sm:text-sm text-muted-faro leading-relaxed">
                  Reçois nos conseils de carrière, les nouvelles formations et des réductions exclusives
                  directement dans ta boîte mail.
                </p>
              </div>
            </div>

            {/* Right Form */}
            <div className="lg:col-span-6">
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Honeypot field for bot deterrence */}
                <input
                  type="text"
                  name="hp"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                />

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ton adresse email (ex: jean@gmail.com)"
                    disabled={status === "loading" || status === "success"}
                    className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted-faro focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange shadow-subtle disabled:opacity-60"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="default"
                    disabled={status === "loading" || status === "success"}
                    className="shrink-0 px-6 py-3 text-sm"
                  >
                    {status === "loading" ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Inscription...</span>
                      </span>
                    ) : (
                      <span>S&apos;abonner →</span>
                    )}
                  </Button>
                </div>

                {/* Status Message */}
                {status === "success" && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-ok bg-ok-tint/80 border border-ok/20 px-3 py-2 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{message}</span>
                  </div>
                )}
                {status === "error" && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-red bg-red-tint/80 border border-red/20 px-3 py-2 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{message}</span>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
