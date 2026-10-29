# Faro School — Guide des Variables d'Environnement (docs/ENVIRONMENT.md)

Ce document détaille l'ensemble des variables d'environnement utilisées par Faro School, leur portée (client/serveur), leur niveau de criticité, leur méthode d'approvisionnement et leur procédure de rotation.

---

## 1. Répertoire Exhaustif des Variables d'Environnement

| Variable | Emplacement / Usage | Portée | Secret ? | Requis en Prod ? | Valeur d'exemple (Placeholder) | Fournisseur | Procédure de Rotation |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | `src/lib/env.ts`, `SiteHeader` | Client/Serveur | Non | Oui | `Faro School` | Équipe Produit | Modifier la valeur dans les variables de déploiement et redéployer. |
| `NEXT_PUBLIC_APP_URL` | `src/lib/env.ts`, métadonnées SEO, webhooks | Client/Serveur | Non | Oui | `https://faroschool.com` | DevOps / Domaine | Mettre à jour l'URL canonique et reconfigurer les URL de redirection chez les prestataires. |
| `NEXT_PUBLIC_SUPABASE_URL` | Initialisation clients Supabase SSR et Browser | Client/Serveur | Non | Oui | `https://xyzproject.supabase.co` | Supabase Dashboard | En cas de migration de projet, changer l'URL et mettre à jour le DNS si domaine personnalisé. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Authentification publique et sessions JWT | Client/Serveur | Non (Publique) | Oui | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase Dashboard (API Settings) | Régénérer dans Supabase Dashboard > Project Settings > API > JWT Secret / Anon Key. Mettre à jour immédiatement et redéployer. |
| `SUPABASE_SERVICE_ROLE_KEY` | Client d'administration Supabase privilégié (`admin.ts`, `create-first-admin.ts`) | **Serveur uniquement** | **OUI (Critique)** | Oui | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase Dashboard (API Settings) | Régénérer le JWT Secret dans Supabase Dashboard. Mettre à jour les secrets Cloudflare (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY`). |
| `APP_ENV` | Détection de l'environnement applicatif | Serveur | Non | Oui | `production` (`staging` ou `development`) | DevOps | Définir dans la console d'hébergement. |
| `KOBARA_MODE` | Mode d'exécution de la passerelle Kobara | Serveur | Non | Oui | `live` | Équipe Intégration | Basculer entre `test` et `live`. En production, `live` est strictement exigé par le code. |
| `KOBARA_API_KEY` (alias `KOBARA_SECRET_KEY`) | Authentification des requêtes de création de paiement vers l'API Kobara | **Serveur uniquement** | **OUI (Financier)** | Oui | `kobara_sk_live_abcdef1234567890` | Tableau de bord Kobara.app | Générer une nouvelle clé API dans Kobara Dashboard, révoquer l'ancienne, mettre à jour le secret (`wrangler secret put KOBARA_API_KEY`). |
| `KOBARA_BASE_URL` (alias `KOBARA_API_URL`) | URL de l'API REST Kobara | Serveur | Non | Oui | `https://api.kobara.app` | Kobara.app | Mise à jour lors des montées de version d'API Kobara. |
| `KOBARA_WEBHOOK_SECRET` | Validation de signature HMAC SHA-256 des webhooks de paiement | **Serveur uniquement** | **OUI (Financier)** | Oui | `whsec_live_987654321fedcba` | Tableau de bord Kobara.app | Définir un nouveau secret dans Kobara Webhooks, mettre à jour la variable `KOBARA_WEBHOOK_SECRET` dans Cloudflare. |
| `CRON_SECRET` | Jeton d'autorisation pour les routes de maintenance planifiées (`/api/cron/escalations`) | **Serveur uniquement** | **OUI** | Oui | `cron_sec_8f4a9b2c3d4e5f6a7b8c9d0e` (64 car. hex) | DevOps / Administrateur | Générer une chaîne pseudo-aléatoire à haute entropie (`openssl rand -hex 32`), mettre à jour Cloudflare secrets et le planificateur externe. |
| `ANTHROPIC_API_KEY` | Assistant pédagogique Claude | **Serveur uniquement** | **OUI** | Optionnel (dégradation gracieuse vers formateur) | `sk-ant-api03-...` | Console Anthropic | Créer une nouvelle clé dans Anthropic Console > API Keys, révoquer l'ancienne, injecter dans Cloudflare secrets. |
| `AI_MODEL` | Modèle Claude utilisé pour l'inférence | Serveur | Non | Non (défaut: `claude-3-haiku-20240307`) | `claude-3-haiku-20240307` | Anthropic | Modifier la chaîne du modèle lors d'une mise à jour de modèle. |
| `BUNNY_STREAM_API_KEY` | Création et gestion des vidéos sur Bunny Stream | **Serveur uniquement** | **OUI** | Oui | `bunny_stream_api_key_xxx` | Console Bunny.net (Stream Library) | Régénérer dans Bunny.net > Video Library > API Key. Mettre à jour `BUNNY_STREAM_API_KEY`. |
| `BUNNY_STREAM_LIBRARY_ID` | Identifiant de la bibliothèque Bunny Stream | Serveur | Non | Oui | `12345` | Console Bunny.net | Copier depuis les paramètres de la bibliothèque. |
| `BUNNY_STREAM_TOKEN_AUTH_KEY` | Signature des jetons d'accès aux flux vidéo HLS (`playlist.m3u8`) | **Serveur uniquement** | **OUI** | Oui | `bunny_token_auth_key_xxx` | Console Bunny.net (Security & DRM) | Changer la clé dans Security & DRM > Token Authentication. Redéployer immédiatement les secrets. |
| `BUNNY_STREAM_HOSTNAME` | Nom de domaine du CDN vidéo Bunny | Serveur | Non | Oui | `video.faroschool.com` | Bunny.net / DNS | Mettre à jour le CNAME DNS. |
| `BUNNY_STORAGE_ZONE_NAME` | Nom de la zone de stockage pour les ressources téléchargeables | Serveur | Non | Oui | `faro-storage` | Console Bunny.net | Configuration initiale. |
| `BUNNY_STORAGE_API_KEY` | Clé d'écriture pour Bunny Storage | **Serveur uniquement** | **OUI** | Oui | `bunny_storage_pass_xxx` | Console Bunny.net (Storage) | Régénérer le mot de passe de la zone de stockage Bunny. |
| `BUNNY_STORAGE_CDN_HOSTNAME` | Domaine CDN de distribution des ressources | Serveur | Non | Oui | `cdn.faroschool.com` | Bunny.net / DNS | Mettre à jour le CNAME DNS. |
| `BUNNY_STORAGE_TOKEN_KEY` | Signature des liens de téléchargement de ressources pour élèves inscrits | **Serveur uniquement** | **OUI** | Oui | `bunny_storage_token_key_xxx` | Console Bunny.net (Pull Zone Security) | Régénérer dans Bunny Pull Zone > Token Authentication. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Adresse e-mail de support affichée et utilisée pour le contact | Client/Serveur | Non | Oui | `support@faroschool.com` | Équipe Support | Mettre à jour la variable et redéployer. |
| `NEXT_PUBLIC_SUPPORT_PHONE` | Téléphone support affiché | Client/Serveur | Non | Oui | `+509 36 00 00 00` | Équipe Support | Mettre à jour la variable et redéployer. |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | Numéro WhatsApp support pour les liens d'assistance directe | Client/Serveur | Non | Oui | `+509 36 00 00 00` | Équipe Support | Mettre à jour la variable et redéployer. |
| `NEXT_PUBLIC_COMPANY_ADDRESS` | Adresse légale de l'entreprise | Client/Serveur | Non | Oui | `Port-au-Prince, Haïti` | Légal / Admin | Mettre à jour la variable et redéployer. |
| `NEXT_PUBLIC_CURRENCY` | Devise monétaire de l'application | Client/Serveur | Non | Oui | `HTG` | Finance | Configuré par défaut sur `HTG`. |
| `ADMIN_EMAIL` | E-mail du compte administrateur initial (utilisé par `scripts/create-first-admin.ts`) | Script CLI | Non | Lors de l'initialisation | `admin@faroschool.com` | Opérateur | Passer en argument CLI ou variable temporaire lors de l'exécution du script. |

---

## 2. Synthèse d'Audit des Variables d'Environnement

### Variables Manquantes (`MISSING`)
*Variables qui étaient utilisées dans le code sans documentation claire ni présence dans `.env.example` avant l'audit :*
- `APP_ENV` : Utilisé pour distinguer production, staging et development.
- `KOBARA_MODE` : Utilisé pour exiger formellement le mode live (`live`) en production.
- `CRON_SECRET` : Clé secrète de protection des routes d'escalade cron.
- `ANTHROPIC_API_KEY` : Clé d'API du moteur IA.
- `NEXT_PUBLIC_SUPPORT_WHATSAPP` : Numéro WhatsApp officiel pour les liens de support.
- `ADMIN_EMAIL` : Nécessaire pour l'initialisation du premier compte administrateur.

### Variables Inutilisées (`UNUSED`)
*Variables présentes dans des fichiers de configuration ou scripts anciens mais non requises par le runtime de production :*
- `KOBARA_PUBLIC_KEY` : L'API Kobara v1 s'authentifie via Bearer secret côté serveur ; la clé publique n'est pas requise.
- `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` : Inutilisé car l'authentification MVP repose exclusivement sur e-mail/mot de passe et liens magiques de récupération.
- `RESEND_API_KEY` : Remplacé par les templates d'e-mail natifs de Supabase Auth.
- `ENABLE_NOTIFICATION_DISPATCH` : Reste d'un flag expérimental de notifications.

### Variables Dupliquées (`DUPLICATED`)
*Valeurs identiques référencées sous des appellations hétérogènes :*
- `KOBARA_API_KEY` vs `KOBARA_SECRET_KEY` : Unifiées dans `src/lib/env.ts` (`KOBARA_API_KEY || KOBARA_SECRET_KEY`).
- `KOBARA_BASE_URL` vs `KOBARA_API_URL` : Unifiées dans `src/lib/env.ts` (`KOBARA_BASE_URL || KOBARA_API_URL`).

### Variables Incorrectement Publiques (`WRONGLY PUBLIC`)
- **Aucune clé secrète exposée en `NEXT_PUBLIC_`** : L'audit confirme qu'aucune clé secrète de rôle de service, clé privée de passerelle de paiement ou token de signature vidéo n'a été préfixée par `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` est intentionnellement publique pour la communication client/Supabase avec politiques RLS.

### Valeurs Précédemment Hardcodées (`HARD-CODED`) et Désormais Centralisées
- URLs des réseaux sociaux (`facebook.com`, `instagram.com`, `youtube.com`) : désormais centralisées dans `src/config/site.ts`.
- Numéro de WhatsApp support : désormais centralisé dans `src/config/contact.ts` via `getWhatsAppNumber()`.
- Slogan et informations de marque : centralisés dans `src/config/site.ts` via `getBrandName()`.

---

## 3. Stockage Sécurisé en Production (Cloudflare Workers)

En production sur Cloudflare Workers :
1. **Variables publiques** : Sont configurées dans la section `[vars]` de `wrangler.jsonc` ou dans le dashboard Cloudflare (ex: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
2. **Secrets de production** : Ne sont **JAMAIS** écrits dans `wrangler.jsonc`. Ils sont injectés de manière chiffrée via la CLI Cloudflare :
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put KOBARA_API_KEY
npx wrangler secret put KOBARA_WEBHOOK_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put BUNNY_STREAM_API_KEY
npx wrangler secret put BUNNY_STREAM_TOKEN_AUTH_KEY
npx wrangler secret put BUNNY_STORAGE_API_KEY
npx wrangler secret put BUNNY_STORAGE_TOKEN_KEY
```
