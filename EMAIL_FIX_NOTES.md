# Corrections du système email

Branche : **email-fix**, créée depuis **auth-migration**. Aucun changement sur Supabase distant, aucun secret affiché, aucun email réel envoyé. Newsletter marketing volontairement hors périmètre.

## Revalidation initiale avant modification

| Constat | Verdict | Preuve du code initial c8d9bed |
|---|---|---|
| E01 | Confirmé | signup, resend-code, forgot-password ignorent success/error après send*. |
| E02 | Confirmé, production non attestée | transport arrête avant fetch si email_suppressions est inaccessible. Aucun accès à la base distante pour vérifier sa présence. |
| E03 | Confirmé | transport regroupe 403/429/500 dans email_delivery, sans statut conservé. |
| E04 | Confirmé | validateEnvironment n’est appelé par aucun démarrage ; ENVIRONMENT.md attribue à tort les envois à Supabase Auth. |
| E05 | Confirmé | liens verification-email fabriqués sans page correspondante. |
| E06 | Confirmé | tokens ignore insert/update errors, Math.random et plusieurs opérations non atomiques. |
| E07 | Confirmé | limites fail-open et non atomiques, alerte sans limite, alreadyVerified, Map locale contact/newsletter. |
| E08 | Confirmé | invitation 48 h contre texte 72 h ; absence de credentials ; reset UPDATE sans résultat vérifié. |
| E09 | Confirmé | destinataire global, HTML interpolé et notification annoncée avant acceptation. |
| E10 | Confirmé | notifyStudent est un console.log ; contact et événements de paiement sans véritable envoi. |
| E11 | Confirmé | mot de passe actuel absent, changement email vérifié et alertes de sécurité absents. |
| E12 | Confirmé | pas d’outbox, de worker de reprise ou d’administration email. |
| E13 | Confirmé | code dans le sujet, versions texte et Reply-To manquants ; le certificat échappait déjà son HTML. |

Aucun constat non confirmé n’a été présenté comme une panne de production certaine. La cause précise de l’absence de tentatives dans le compte Resend reste une vérification d’exploitation à effectuer après configuration.

## Lots et architecture finale

1. **ad714f6 — activation et honnêteté** : résultat typé, catégories stables et corrélation ; traces privées ; wording neutre FR/KR ; validation réelle par src/instrumentation.ts ; limites SQL ; codes Web Crypto, comparaison constante et consommation verrouillée ; page du lien FR/KR ; documentation corrigée. Typecheck, lint, 12 suites historiques et test PostgreSQL ciblé passaient au commit.
2. **b258cfb — fiabilité et administration** : email_outbox privée, claims FOR UPDATE SKIP LOCKED, idempotence, backoff, Retry-After, webhooks liés au message prestataire, cron et écran admin. Templates centralisés FR/KR, texte + HTML échappé, code uniquement dans le corps. Typecheck/lint et tests historiques + régressions email passaient au commit.
3. **Lot métier** : invitations, paiements, remboursements/accès retirés, certificats, sécurité, changement email, contact et escalades. Capture transactionnelle en SQL, envoi HTTP exclusivement dans le Worker. Les exceptions Next nécessaires au rendu dynamique de l’authentification sont propagées ; une erreur de credentials ne produit plus une session implicitement valide.

### État d’un email

queued → sending → accepted → delivered. **accepted signifie uniquement acceptation par l’API Resend**, jamais arrivée en boîte de réception. bounced, complained et suppressed restent visibles. Une panne avant Resend est également visible dans l’outbox ou, si la base entière est indisponible, dans les logs Worker structurés par catégorie et correlationId. Les protections de suppression et RLS restent actives.

Les erreurs permanentes 4xx ne sont pas reprises automatiquement. Les erreurs temporaires, 429, 5xx et timeouts sont reprises, au plus cinq tentatives au total, avec backoff et respect de Retry-After. La liste des délais est 1 min, 5 min, 30 min, 2 h, 6 h ; avec cinq tentatives **au total**, seuls les quatre premiers intervalles précèdent une nouvelle tentative automatique. Un administrateur peut relancer une erreur corrigible, après audit et limite, sans changer la clé prestataire. Aucune reprise d’un ancien envoi ambigu après 23 heures : Resend ne garantit ses clés d’idempotence que 24 heures.

### Secrets des emails d’authentification

Les six chiffres sont générés avec crypto.getRandomValues et rejection sampling. Code et jeton naissent à la première tentative d’envoi. L’outbox ne stocke ni code, ni jeton, ni mot de passe. Pour pouvoir soumettre **exactement le même contenu** après un timeout d’acceptation inconnu, un matériel AES-GCM chiffré est conservé dans une table distincte email_outbox_material, liée à l’outbox, sans policies et avec accès service_role uniquement. AUTH_SECRET sert à dériver la clé de chiffrement ; le nonce est aléatoire et l’ID de l’outbox est authentifié comme AAD. Les tables de vérification conservent les empreintes uniquement. Aucun matériel secret n’est retourné par les routes ou l’administration.

Une reprise ne modifie pas le code ; sa validité est recalée sur l’envoi. Un renvoi ne détruit jamais un code antérieurement accepté. Les tentatives invalides sont verrouillées par adresse et comptées pour tous les codes encore actifs. Les liens consommés sont refusés. Après vérification valide, le serveur crée la session Auth.js ; la preuve interne signée ne passe jamais dans le navigateur. Le paramètre next est limité aux chemins relatifs, y compris les contrôles et séparateurs encodés.

### Événements métier

- **Invitation** : credentials inutilisables aléatoires créés avec ignoreDuplicates ; une invitation ne remplace pas le mot de passe d’un compte existant. Durée 48 h partagée avec le template. Reset transactionnel par UPSERT + token_version ; vérification de l’invitation lors de la définition du mot de passe. L’admin reçoit un état pending si l’envoi n’est pas accepté. Promotion existante via le RPC autorisé de rôle, avec invalidation des sessions.
- **Escalade** : SQL vérifie l’élève, la conversation, le message enregistré et le formateur du cours. Adresse d’escalade du formateur, puis profil, puis secours déclaré ; langue du destinataire. Question échappée par le renderer. Escalade et email créés atomiquement. Le message « notifié » est ajouté uniquement après acceptation, une fois, y compris après reprise.
- **Paiements** : triggers sur l’état réellement enregistré après webhook signé, validation administrateur ou recheck de confiance. Clé par paiement/type. Confirmation avec formation, montant, accès et reçu protégé ; échec avec catégorie neutre ; remboursement/retrait d’accès. Aucun email fondé sur les paramètres du retour navigateur.
- **Certificat** : capture à l’émission, clé certificate:<id>, liens uniquement, aucun PDF attaché.
- **Sécurité** : changement authentifié exigeant le mot de passe actuel ; reset et changement incrémentent token_version. Alerte transactionnelle après modification. Nouvelle adresse remplacée seulement après code/lien valide, sessions invalidées et ancienne adresse avertie.
- **Contact** : message et email support enregistrés dans une transaction, sans faux succès de stockage. Newsletter conservée sans marketing ; seul son limiteur est devenu partagé en SQL.

## Migrations à appliquer toi-même

Appliquer les fichiers **dans l’ordre**, après les migrations existantes Auth.js/certificats/webhooks :

1. supabase/migrations/20261030111657_email_activation_safety.sql
2. supabase/migrations/20261030112336_email_outbox.sql
3. supabase/migrations/20261030113015_email_business_events.sql

Prérequis particulièrement important : **20261030001418_bunny_resend_webhooks.sql**, qui crée email_suppressions et email_deliveries. Ne pas supprimer la vérification des suppressions pour contourner son absence.

Nouvelles tables : email_send_attempts, email_rate_budgets, email_outbox, email_outbox_material. RLS activée, aucune policy de lecture navigateur, grants explicites service_role. Les fonctions mutantes sont retirées de PUBLIC, anon et authenticated ; les fonctions de trigger ne sont pas des API publiques. Les triggers SECURITY DEFINER sont limités à la capture des événements/effets autorisés et ont un search_path fixé. Aucune permission anonyme ajoutée.

## Étapes manuelles — Cloudflare et Resend

1. Déployer cette branche après application des trois migrations. Aucun push ou déploiement n’a été déclenché dans cette correction.
2. Dans les **secrets runtime du Worker principal**, définir AUTH_SECRET, SUPABASE_JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET et EMAIL_FROM. Configurer aussi SUPPORT_EMAIL et éventuellement INSTRUCTOR_ESCALATION_EMAIL. Conserver les autres secrets de production requis par env.ts, dont Kobara et Bunny. Ne jamais utiliser de préfixe NEXT_PUBLIC pour un secret.
3. Configurer les variables publiques existantes NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY avec le bon environnement. AUTH_URL doit correspondre au domaine public si utilisé. Générer AUTH_SECRET avec openssl rand -base64 32, différent par environnement. Une rotation de ce secret invalide les sessions et empêche de déchiffrer les anciens envois d’authentification en attente : traiter/annuler la file avant rotation.
4. EMAIL_FROM doit être une adresse valide ou un nom suivi d’une adresse entre chevrons. Vérifier son domaine dans **le même compte Resend que la clé** ; appliquer les DNS SPF/DKIM indiqués par Resend et vérifier le statut Verified. La clé **Sending access** est suffisante pour envoyer : le restricted_api_key reçu antérieurement sur GET /domains ne prouve pas une clé d’envoi invalide et ne nécessite pas Full access.
5. Configurer le webhook Resend sur /api/webhooks/resend, événements email.sent, email.delivered, email.delivery_delayed, email.failed, email.bounced, email.complained, email.suppressed et suppressions si disponibles. Copier son secret de signature dans RESEND_WEBHOOK_SECRET du Worker principal.
6. Déployer le Worker ordonnanceur fourni avec **pnpm exec wrangler deploy --config wrangler.email-cron.jsonc**. Définir son CRON_SECRET avec **pnpm exec wrangler secret put CRON_SECRET --config wrangler.email-cron.jsonc**, identique à celui du Worker principal. Son APP_URL doit viser l’application du même environnement. Le cron fourni appelle /api/cron/email-outbox chaque minute avec un Bearer secret. Une autre planification sécurisée du même endpoint est possible ; ne pas mettre le secret dans l’URL.
7. Ouvrir /fr/admin/emails ou /ht/admin/emails en administrateur vérifié. Examiner les tables, la configuration, les dernières catégories d’échec et les corrélations. Cliquer **Envoyer un test à ma propre adresse vérifiée** : seule cette adresse peut être utilisée, avec une limite d’un test par minute. Vérifier ensuite acceptation, callback delivered et réception. Le présent travail n’a utilisé aucun bouton réel.
8. Une configuration obligatoire absente empêche le démarrage en production : dans ce cas, les noms des variables manquantes sont dans les logs de démarrage ; la carte admin n’est accessible qu’après correction des secrets minimaux. Une table absente reste un échec visible dans la carte de santé lorsque l’application démarre.
9. Continuer le diagnostic initial avec cette visibilité. Ne pas modifier Supabase Auth/SMTP : l’authentification est Auth.js, **Resend assure les envois**.

## Vérifications et limites des preuves

- Régressions locales des modules réels et handlers HTTP, avec fournisseurs simulés ; PostgreSQL PGlite pour les transactions, grants et concurrence. Aucun test ne contacte Supabase distant ni n’envoie un email réel.
- Les défauts du diagnostic initial ont des assertions corrigées : suppression absente/bloquée, clé absente, développement skipped, catégories HTTP distinctes, réponses publiques neutres, alerte limitée, création de jeton refusée sur erreur SQL, limite fail-closed, HTML échappé.
- Tests supplémentaires : 429/Retry-After, reprise avec contenu identique, unicité, liaison webhook/outbox, cinq tentatives, consommations et réservations concurrentes, invitation/reset, sécurité, paiement/remboursement, véritable destinataire d’escalade, message système après acceptation seulement, contact atomique, droits admin, test vers soi-même, cron et véritable hook de démarrage sans chacun des six secrets requis.
- Le script qui démontrait les anciens défauts est archivé en texte dans docs/audit-baseline/audit-email-offline.ts.txt ; les tests de régression sont dans tests/email-*.test.ts.
- **18 PNG réels** : docs/screenshots/email/ — deux états admin à 1440 px ; liens FR/KR valide/expiré/déjà utilisé à 390 px ; saisie neutre FR/KR à 390 px ; quatre emails FR/KR. Les composants de production sont rendus dans une fixture locale, les états prestataire sont simulés, les codes et URL sont masqués. checks.json décrit la méthode. Ce ne sont pas des captures d’une boîte mail réelle ni d’une base de production.
- La réception Gmail, les DNS vérifiés dans Resend et le fonctionnement sur le Worker déployé exigent les étapes manuelles ci-dessus. Aucun succès local ne les remplace.

Sources techniques consultées : [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email), [clés d’idempotence et durée de 24 h](https://resend.com/docs/dashboard/emails/idempotency-keys), [démarrage Next par instrumentation](https://nextjs.org/docs/app/guides/instrumentation).

## Résultat final de validation

Typecheck et lint réussis ; **16/16 suites** réussies, plus la dernière régression ciblée de confidentialité du matériel chiffré. Scan des secrets propre. Build **OpenNext/Cloudflare complet** réussi dans la copie de validation à dépendances hoistées, avec configuration fictive et sans clés réelles ; identité octet par octet des sources src vérifiée. Le démarrage Next de production avec la configuration fictive incomplète échoue dans instrumentation et ne sert pas de page normale (HTTP 500), conformément au refus de configuration. Les six variables critiques sont également testées séparément contre le véritable register().

Les 18 captures finales et leur galerie sont dans docs/screenshots/email/README.md. Le bootstrap administrateur n’affiche désormais plus d’adresse complète ni de lien de configuration secret ; il utilise la file d’invitation et n’est pas exécuté pendant ce travail. Les durées réelles sont calculées à partir de EMAIL_TIMES, la même source que les templates.
