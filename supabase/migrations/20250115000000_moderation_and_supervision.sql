-- Migration: 20250115000000_moderation_and_supervision.sql
-- Description: Community moderation queue, user mutes/bans, word filters, platform settings, and messaging supervision audit logs

-- 1. Generalize admin_audit_logs to support all administrative actions
ALTER TABLE IF EXISTS public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS target_type TEXT,
  ADD COLUMN IF NOT EXISTS target_id TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

-- 2. Platform settings table (stores word filters, community rules, global AI config)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage platform settings"
  ON public.platform_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Allow all authenticated users to read community rules and word filters
CREATE POLICY "Public read community rules and word filters"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (key IN ('community_rules', 'word_filter'));

-- 3. Break-Glass Private Conversation Access Logs
CREATE TABLE IF NOT EXISTS public.private_conversation_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  context TEXT NOT NULL CHECK (context IN ('report', 'escalation')),
  reason TEXT NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.private_conversation_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view and insert break-glass access logs"
  ON public.private_conversation_access_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 4. Initial Seed for platform_settings
INSERT INTO public.platform_settings (key, value)
VALUES
  (
    'word_filter',
    '{
      "fr": ["connard", "salope", "bâtard", "batard", "enculé", "encule", "pute", "nique", "merde", "trouduc"],
      "ht": ["madichon", "tenten", "kokat", "koko", "baba", "kriye", "salopri", "fatra", "volè", "vole", "kouto", "kaka"]
    }'::jsonb
  ),
  (
    'community_rules',
    '{
      "fr": "### Règles de la Communauté Faro School\n\n1. **Respect et courtoisie** : Tous les membres méritent respect et bienveillance. Aucun propos haineux, discriminatoire ou insultant ne sera toléré.\n2. **Pas de spam ni d''auto-promotion non sollicitée** : Les liens externes suspects, sollicitations financières ou offres douteuses sont strictement interdits.\n3. **Entraide et partage** : Posez vos questions clairement et partagez vos apprentissages pour grandir ensemble.",
      "ht": "### Règleman Kominote Faro School\n\n1. **Respè ak bèl konpòtman** : Tout manm merite respè ak jantiyès. Okenn jouman, diskriminasyon oswa ensilte pap tolere.\n2. **Pa fè spam ni piblisite san otorizasyon** : Lyen dwòl, pwopozisyon lajan fasil oswa aktivite sispèk entèdi nèt.\n3. **Kole zepòl ak pataj** : Poze kesyon w yo klè epi pataje sa w aprann pou nou tout ka avanse ansanm."
    }'::jsonb
  ),
  (
    'global_ai_settings',
    '{
      "default_model": "claude-3-haiku-20240307",
      "default_confidence_threshold": 0.75,
      "daily_cost_cap_usd": 5.0,
      "student_daily_limit": 30,
      "kill_switch": false
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
