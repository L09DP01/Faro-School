# Webhooks Faro School

## Routes implémentées

| Service | Méthode et URL | Usage |
| --- | --- | --- |
| Kobara (existant) | POST https://faroschool.com/api/webhooks/kobara | Paiements MonCash/NatCash |
| Bunny Stream | POST https://faroschool.com/api/webhooks/bunny | Cycle vidéo, encodage, durée et suppression |
| Resend | POST https://faroschool.com/api/webhooks/resend | Livraison email, erreurs, rebonds, plaintes et suppressions |

Les URL utilisent le domaine actuellement configuré. Adapter l’origine si le domaine réel change. Les routes Bunny et Resend n’exigent pas de session Auth.js : elles exigent une signature valide du prestataire. Aucune page ni mise en forme de certificat n’est modifiée.

## Étapes manuelles, dans cet ordre

1. **Appliquer toi-même** la migration locale `supabase/migrations/20261030001418_bunny_resend_webhooks.sql`, après les migrations existantes. Aucune opération n’a été faite dans ton compte Supabase. Les tests SQL utilisent uniquement PGlite local.
2. Configurer dans Cloudflare, côté serveur, `BUNNY_STREAM_READ_ONLY_API_KEY` (clé **Read-Only** de la bibliothèque Stream, pas la clé API écriture ni la clé Token Authentication) et `RESEND_WEBHOOK_SECRET` (secret de signature `whsec_…` de ce webhook Resend). Conserver `BUNNY_STREAM_LIBRARY_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_SERVICE_ROLE_KEY` et les autres secrets existants. Ne pas mettre ces valeurs dans Git ou dans le chat.
3. Déployer le code. Les deux nouveaux secrets sont obligatoires dans la validation d’environnement de production ; les routes refusent aussi de traiter les requêtes si leur secret manque.
4. Dans Bunny Stream → bibliothèque concernée → Webhooks, renseigner l’URL Bunny ci-dessus. Bunny utilise la clé Read-Only pour signer automatiquement. Le récepteur exige le format courant comportant `EventId` et `Timestamp`. Les anciens payloads sans ces champs sont refusés plutôt que d’inventer un ordre d’événements.
5. Dans Resend → Webhooks, créer l’endpoint avec l’URL Resend ci-dessus, copier son secret dans Cloudflare, et sélectionner : `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.failed`, `email.bounced`, `email.complained`, `email.suppressed`, `suppression.added`, `suppression.removed`. Si le secret n’était pas disponible à l’étape 2, le renseigner et redéployer avant d’activer les livraisons.
6. Effectuer les essais réels du dernier paragraphe. Aucune configuration Bunny, Resend ou Cloudflare n’a été modifiée automatiquement.

**Migration avant déploiement :** le transport email commun consulte la table de suppression avant tout envoi réel. Si cette table est absente ou indisponible, l’envoi est refusé, pour éviter de contourner les blocages. Les réponses publiques des parcours d’authentification restent génériques.

## Bunny : comportement et sécurité

- En-têtes obligatoires : `X-BunnyStream-Signature-Version: v1`, `X-BunnyStream-Signature-Algorithm: hmac-sha256`, `X-BunnyStream-Signature`. HMAC-SHA256 du **corps brut**, avec Web Crypto ; comparaison cryptographique, avant décodage JSON et validation Zod.
- Bibliothèque entrante strictement égale à `BUNNY_STREAM_LIBRARY_ID`. GUID validés, URL de lecture des métadonnées fixe, sans redirection, délai maximum 8 secondes.
- États traités : 0/1/2 (encodage), 3 (terminé), 4 (première résolution lisible), 5 (échec), 6/7/8 (upload présigné), 32 (suppression). Les événements live, sous-titres et génération de métadonnées non utilisés sont acquittés et ignorés.
- Pour 3 et 4, récupération serveur de la durée via l’API Bunny, avec contrôle GUID/bibliothèque, puis mise à jour de `lessons.duration_sec`. Aucune durée envoyée par un navigateur n’est utilisée. Le trigger synchronise aussi une leçon enregistrée **après** l’arrivée du webhook.
- L’état est gardé dans `bunny_video_assets`, même lorsqu’aucune leçon ne référence encore cette vidéo. Suppression : état conservé et durée remise à zéro ; la leçon, les progressions et les certificats historiques ne sont pas supprimés.
- Déduplication par `EventId` ; ordre par `Timestamp`, pas par heure d’arrivée. Les événements de même date utilisent une priorité d’état. Les retards de plusieurs heures sont acceptés pour permettre les retries Bunny. Une date supérieure de plus de cinq minutes à l’heure serveur est refusée.

## Resend : comportement et sécurité

- Vérification Svix HMAC-SHA256 sur `svix-id.svix-timestamp.corps-brut`, clé Base64 après le préfixe `whsec_`, signatures `v1` multiples acceptées pour rotation, tolérance temporelle ±5 minutes. Implémentation Web Crypto testée avec le vecteur officiel Svix.
- Les états de livraison sont conservés par email prestataire et **empreinte SHA-256 du destinataire normalisé**. Cette empreinte est pseudonyme, pas une anonymisation ; les tables restent privées.
- Rebonds permanents, plaintes spam, `email.suppressed` et `suppression.added` bloquent les nouveaux envois. Un rebond temporaire ou un simple `email.failed` ne bloque pas définitivement l’adresse.
- Une `suppression.removed` signée peut lever le blocage ; un événement plus ancien ne peut pas le rétablir. Une simple livraison réussie ne lève jamais un blocage.
- Tous les envois existants (authentification, invitations, certificats, escalade de messagerie) passent par le transport commun `src/lib/email/transport.ts`. Aucun webhook ne renvoie automatiquement un email ni ne déclenche une boucle de retries payants.
- Un événement `email.delivered` ne vérifie **jamais** un compte, ne crée pas de session et ne remplace pas la saisie du code de vérification. Les ouvertures/clics et événements non utilisés sont acquittés sans suivi.

## Persistance, erreurs et confidentialité

Quatre tables, RLS activée, aucune policy navigateur, droits explicites limités à `service_role` : `webhook_events`, `bunny_video_assets`, `email_deliveries`, `email_suppressions`. Les deux RPC d’ingestion sont SECURITY INVOKER et exécutables uniquement par ce rôle. Le trigger de synchronisation des durées est SECURITY DEFINER avec chemin de recherche vide et requêtes fixes, afin de lire uniquement les métadonnées vidéo privées pendant une sauvegarde de leçon autorisée.

Le reçu et l’effet sont dans la **même transaction**. Un échec annule le reçu et permet au prestataire de réessayer. Les reçus restent conservés pour garantir la déduplication ; aucune purge automatique n’est ajoutée. Répondre 200 à un doublon est intentionnel. Erreurs temporaires base/API → 503 ; signature invalide → 401 ; bibliothèque différente → 403 ; JSON/schéma invalide → 400 ; corps dépassant 64 Ko → 413. Réponses `no-store`.

Ni corps brut, ni email en clair, sujet, code, lien d’authentification, signature ou clé n’est conservé dans les nouvelles tables ou journaux. Seuls les identifiants, états, dates, empreintes de destinataires et empreintes du corps sont stockés. Les erreurs fournisseur brutes ne sont ni renvoyées au client ni journalisées par le transport commun.

## Validation locale et essais réels

`pnpm test:webhooks` exécute les vrais gestionnaires HTTP et la migration SQL réelle dans PostgreSQL embarqué, avec entrées/sorties prestataires simulées. Il couvre signatures falsifiées, vecteur Svix officiel, taille, bibliothèque, idempotence, ordre, durée, sauvegarde tardive de leçon, suppression vidéo, erreurs/retries, suppression email, absence de validation de compte, confidentialité, grants et rollback. Cette suite fait partie de `pnpm test`.

Après configuration distante : uploader une vidéo de test dans la bonne bibliothèque et vérifier sa durée après encodage ; relivrer le même événement et un événement plus ancien ; tester la suppression d’une vidéo de test ; utiliser les événements de test Resend livrés/signés par son dashboard et vérifier les états et suppressions, puis lever explicitement une suppression de test. Les consoles des prestataires doivent recevoir des 2xx pour les événements valides et les doublons. Les validations locales ne certifient pas une configuration distante non déployée.

## Documentation officielle consultée

- Bunny : https://bunny.net/docs/stream/webhooks (signature, EventId, Timestamp, états et retries).
- Bunny Get Video : https://bunny.net/docs/api-reference/stream/manage-videos/get-video (durée).
- Resend : https://resend.com/docs/webhooks/verify-webhooks-requests et https://resend.com/docs/webhooks/event-types .
- Suppressions : https://resend.com/docs/webhooks/suppressions/added et https://resend.com/docs/webhooks/suppressions/removed .
- Svix, protocole et vecteur de test : https://docs.svix.com/receiving/verifying-payloads/how-manual .

## Compatibilité OpenNext / Cloudflare

Les deux nouvelles routes déclarent le runtime Next.js `nodejs`, comme demandé par l’adaptateur OpenNext existant, puis s’exécutent dans Cloudflare Workers. La vérification de signature utilise exclusivement Web Crypto et les API Web ; aucun module crypto Node ni Buffer n’est utilisé dans le code de production. Compilation autonome des deux routes pour plateforme navigateur réussie. Référence : https://opennext.js.org/cloudflare#supported-nextjs-runtimes .

### Résultats enregistrés

Validation locale : 12/12 suites générales réussies en mode hors ligne ; 28 contrôles webhook réussis après l’ajustement final OpenNext ; `pnpm typecheck` et `pnpm lint` réussis. Les deux routes se compilent également pour une cible navigateur sans API Node natives. Les tests distants et le déploiement n’ont pas été exécutés.
