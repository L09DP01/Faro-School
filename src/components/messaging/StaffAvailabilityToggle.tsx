"use client";

import { useState, useEffect, useTransition } from "react";
import { CircleDot, Loader2 } from "lucide-react";
import { staffHeartbeatAction, toggleStaffAvailabilityAction, getStaffAvailabilityAction } from "@/app/actions/private-messaging";

interface StaffAvailabilityToggleProps {
  initialAvailable?: boolean;
  locale?: string;
}

export function StaffAvailabilityToggle({
  initialAvailable = true,
  locale = "fr",
}: StaffAvailabilityToggleProps) {
  const [isAvailable, setIsAvailable] = useState(initialAvailable);
  const [isPending, startTransition] = useTransition();

  // Heartbeat every 30 seconds
  useEffect(() => {
    void getStaffAvailabilityAction().then(r=>{if(r.success&&r.data)setIsAvailable(r.data.available);});
    // Send immediate heartbeat on mount
    staffHeartbeatAction();

    const interval = setInterval(() => {
      staffHeartbeatAction();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    const nextState = !isAvailable;
    setIsAvailable(nextState);

    startTransition(async () => {
      const result=await toggleStaffAvailabilityAction(nextState);
      if(!result.success)setIsAvailable(!nextState);
    });
  };

  const isHt = locale === "ht";

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-heading font-semibold transition-all border shadow-subtle ${
        isAvailable
          ? "bg-ok-tint text-ok border-ok/30 hover:bg-ok-tint/80"
          : "bg-surface text-muted-faro border-line hover:bg-bg"
      }`}
      title={
        isAvailable
          ? isHt
            ? "Ou disponib pou resevwa mesaj dirèk etidyan yo"
            : "Vous êtes disponible pour recevoir les messages directs"
          : isHt
            ? "Ou endisponib : Asistan IA a oswa imèl ap pran relè a"
            : "Vous êtes indisponible : L'assistant IA ou les e-mails prendront le relais"
      }
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-faro" />
      ) : (
        <CircleDot
          className={`w-3.5 h-3.5 ${
            isAvailable ? "text-ok fill-ok" : "text-muted-faro"
          }`}
        />
      )}
      <span>
        {isAvailable
          ? isHt
            ? "Disponib"
            : "Disponible"
          : isHt
            ? "Endisponib"
            : "Indisponible"}
      </span>
    </button>
  );
}
