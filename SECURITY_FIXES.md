# Journal des Correctifs de Sécurité (SECURITY_FIXES.md)

Ce document répertorie chronologiquement les vulnérabilités auditées, les correctifs appliqués, les preuves de vérification et la table des privilèges de base de données.

---

## STEP S1-A: Identité, Sessions et Contrôle d'Accès

### Ce qui n'allait pas (Vulnérabilités critiques)
1. **Contournement d'identité par cookie non signé (`faro_session`)** :
   - `src/lib/auth/get-user.ts` et `src/middleware.ts` décodaient un cookie Base64 `faro_session` et accordaient aveuglément l'identifiant `id` et le rôle `role` sans aucune validation cryptographique ni vérification auprès de Supabase Auth. Un attaquant pouvait forger `{"role": "admin"}` et s'octroyer des privilèges administrateur complets.
2. **Identifiants de démonstration codés en dur avec mots de passe fixes** :
   - `src/app/api/auth/login/route.ts` acceptait des mots de passe codés en dur (`Admin123!`, `Student123!`, `Instructor123!`) et générait un cookie `faro_session` sans vérifier le hash de mot de passe en base de données.
3. **Absence de protection `server-only` sur le client privilégié** :
   - `src/lib/supabase/admin.ts` n'était pas balisé `server-only` et basculait sur la clé anonyme publique si `SUPABASE_SERVICE_ROLE_KEY` était absent au lieu d'échouer immédiatement.
4. **Mise en cache du rôle** :
   - Le rôle n'était pas garanti vérifié depuis la table `profiles` sur chaque requête protégée.

### Ce qui a été modifié
1. **Suppression définitive de `faro_session`** :
   - Dans `src/lib/auth/get-user.ts` et `src/middleware.ts`, suppression intégrale de tout chemin de code lisant ou décodant `faro_session`.
   - L'unique source d'identité est désormais la session Supabase Auth vérifiée côté serveur via `supabase.auth.getUser()` (qui valide cryptographiquement le jeton JWT auprès du serveur d'authentification).
   - Le rôle est systématiquement lu depuis `profiles.role` pour le `user.id` vérifié et mémorisé uniquement pour la durée de la requête via `React.cache()`.
2. **Suppression des comptes de démonstration en dur dans la route de connexion** :
   - Dans `src/app/api/auth/login/route.ts`, suppression de tous les comptes de test et mots de passe codés en dur. Toute authentification passe obligatoirement par `supabase.auth.signInWithPassword()`.
   - Dans `src/app/api/auth/signup/route.ts`, suppression du repli qui créait une fausse session en cas d'échec d'inscription.
   - Dans `src/app/api/auth/signout/route.ts`, suppression du cookie résiduel.
3. **Protection `server-only` et principe "Fail Closed"** :
   - Ajout de `import "server-only";` dans `src/lib/supabase/admin.ts` et `src/lib/auth/get-user.ts`.
   - `createAdminClient()` lève une exception bloquante si `SUPABASE_SERVICE_ROLE_KEY` ou `NEXT_PUBLIC_SUPABASE_URL` est manquant en production.
   - Création de `isDemoMode()` dans `src/lib/config/index.ts` avec interdiction bloquante (`throw Error`) si `APP_MODE=demo` est détecté en production.
4. **Ajout de `requireInstructor()`** dans `src/lib/auth/require-admin.ts` pour garantir la validation de rôle formateur côté serveur.

### Comment cela a été vérifié
- **Test automatisé (`tests/step-s1a-identity.test.ts`)** :
  1. *Cookie forgé* : injection d'un cookie `faro_session` contenant `role: "admin"` -> `getCurrentUser()` renvoie strictement `null` (accès refusé).
  2. *Mots de passe fixes* : tentative de connexion avec `admin@faroschool.com` / `Admin123!` -> rejet avec statut HTTP 400/401 (`invalidCredentials`), aucun cookie de session délivré.
  3. *Actions protégées* : appels non authentifiés à `createInstructorAction` et `deleteReportedMessageAction` -> rejet immédiat avec refus d'accès.
- **Typecheck** : `tsc --noEmit` validé avec code 0.

---

## STEP S1-B: Rôles en Base de Données et Privilèges SQL

### Ce qui n'allait pas (Vulnérabilités critiques)
1. **Élévation de privilèges à l'inscription** :
   - La fonction `handle_new_user()` utilisait `COALESCE(NEW.raw_user_meta_data->>'role', 'student')`. Tout utilisateur pouvait s'inscrire en spécifiant `{ role: "admin" }` dans ses métadonnées et devenir administrateur dès la création du profil.
2. **Absence de protection sur `profiles.role` lors de la mise à jour** :
   - La politique RLS `Users can update own profile` autorisait les utilisateurs authentifiés à modifier n'importe quelle colonne de leur profil sans clause de restriction sur `role`.
3. **Absence de fonction RPC sécurisée et auditée pour le changement de rôle**.
4. **Permissions par défaut de l'utilisateur anonyme (`anon`)** : risque d'écriture non désirée si RLS n'était pas activé sur une nouvelle table.

### Ce qui a été modifié
1. **Nouvelle migration `supabase/migrations/20250118000000_role_security_and_privilege_guards.sql`** :
   - Redéfinition de `handle_new_user()` : le rôle attribué est **toujours** `'student'` de façon inconditionnelle. La valeur `raw_user_meta_data->>'role'` est strictement ignorée. Les champs `full_name` et `phone` sont nettoyés et limités en longueur.
   - Création du trigger `trg_protect_profile_privileged_fields` (BEFORE UPDATE sur `profiles`) : lève une exception SQL (`RAISE EXCEPTION`) immédiate si `role`, `banned_at` ou `muted_until` est altéré par un utilisateur non-administrateur.
   - Révocation formelle de la permission de mise à jour sur la colonne `role` : `REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;`.
   - Durcissement de la politique RLS avec clause `WITH CHECK` interdisant toute modification de `role`.
   - Création de la fonction RPC `public.set_user_role(target_user_id UUID, new_role TEXT)` : exclusivement exécutable par les administrateurs (`SECURITY DEFINER`), validant le nouveau rôle et consignant chaque changement dans `admin_audit_logs`.
   - Révocation formelle de tout droit d'écriture pour le rôle `anon` sur l'ensemble du schéma `public` : `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;`.
   - Révocation de `TRUNCATE` pour `authenticated` et verrouillage en écriture directe sur les tables d'audit et de configuration (`admin_audit_logs`, `coupons`, `ai_usage`, `platform_settings`).
2. **Ajout de la commande de test d'intégration `pnpm test:db`** dans `package.json` (`tests/db-roles-and-rls.test.ts`).

### Table des Grants et Politiques RLS du Schéma Public

| Table | Rôle `anon` | Rôle `authenticated` | Contrôle d'accès & Politiques RLS |
| :--- | :--- | :--- | :--- |
| `profiles` | SELECT (public info) | SELECT (own), UPDATE (own, colonnes sûres) | RLS : UPDATE sur `role` révoqué; trigger bloquant si non-admin |
| `courses` | SELECT (publiés) | SELECT (publiés + own formateur) | RLS : écriture réservée admin & formateur assigné |
| `modules` | SELECT | SELECT | RLS : écriture réservée formateur du cours & admin |
| `lessons` | SELECT (aperçus) | SELECT (selon inscription) | RLS : accès restreint aux inscrits |
| `lesson_resources` | Aucun | SELECT (selon inscription) | RLS : réservé aux apprenants inscrits |
| `coupons` | Aucun | SELECT (validation) | RLS : écritures directes révoquées; admin RPC |
| `enrollments` | Aucun | SELECT (own enrollments) | RLS : insertion automatique par validation paiement |
| `lesson_progress` | Aucun | SELECT, INSERT, UPDATE (own) | RLS : l'utilisateur ne peut modifier que sa progression |
| `orders` | Aucun | SELECT, INSERT (own orders) | RLS : un élève ne peut ni lire ni modifier les commandes d'autrui |
| `payments` | Aucun | SELECT (own payments) | RLS : écriture réservée au webhook/RPC serveur |
| `certificates` | SELECT (par code) | SELECT (own) | RLS : génération automatique sur 100% de progression |
| `reviews` | SELECT | SELECT, INSERT (own) | RLS : un avis par étudiant inscrit |
| `contact_messages` | INSERT (rate limited) | INSERT | RLS : lecture et gestion réservées admin |
| `playback_sessions` | Aucun | SELECT, INSERT, UPDATE (own) | RLS : vérification limite de 2 appareils simultanés |
| `lesson_notes` | Aucun | SELECT, INSERT, UPDATE, DELETE (own) | RLS : notes personnelles isolées par utilisateur |
| `admin_audit_logs` | Aucun | Aucun (écritures directes révoquées) | RLS : SELECT admin uniquement; écritures par triggers/RPC |
| `newsletter_subscribers`| INSERT | INSERT | RLS : gestion admin |
| `instructors` | SELECT (actifs) | SELECT (actifs) | RLS : gestion admin (`instructors.manage`) |
| `community_messages` | Aucun | SELECT, INSERT (si non banni/sourdine) | RLS : modération et suppression douce |
| `community_reactions`| Aucun | SELECT, INSERT, DELETE (own) | RLS : réactions isolées par utilisateur |
| `community_reports` | Aucun | INSERT (own reports) | RLS : examen admin |
| `community_reads` | Aucun | SELECT, INSERT, UPDATE (own) | RLS : horodatage de lecture individuel |
| `community_rules_accepted` | Aucun | SELECT, INSERT (own) | RLS : acceptation unique |
| `conversations` | Aucun | SELECT (participants), INSERT | RLS : validation stricte élève <-> formateur/admin |
| `messages` | Aucun | SELECT (participants), INSERT | RLS : messages privés strictement isolés |
| `escalations` | Aucun | SELECT (staff assigné/admin) | RLS : suivi des délais de réponse |
| `ai_usage` | Aucun | Aucun (écritures directes révoquées) | RLS : suivi comptable et plafonds par instance |
| `notifications` | Aucun | SELECT, UPDATE (own) | RLS : notifications isolées par utilisateur |
| `instructor_ai_versions` | Aucun | SELECT (staff/admin) | RLS : gestion par formateur assigné |
| `platform_settings` | Aucun | Aucun (écritures directes révoquées) | RLS : lecture/écriture admin |
| `private_conversation_access_logs` | Aucun | Aucun | RLS : audit log de consultation admin |
| `moderation_flags` | Aucun | INSERT (détection serveur) | RLS : lecture et traitement admin uniquement |

### Comment cela a été vérifié
- **Test automatisé (`tests/db-roles-and-rls.test.ts` via `pnpm test:db`)** :
  1. *Validation de la migration* : vérification stricte de l'interdiction de `role` dans `handle_new_user`, de la présence du trigger `protect_profile_privileged_fields`, de la révocation de l'UPDATE de colonne `role`, et de la fonction RPC `set_user_role`.
  2. *Vérification des privilèges* : vérification de la révocation de toutes les écritures pour `anon`.
  3. Exécution avec succès de `pnpm test:db`.
- **Typecheck** : `tsc --noEmit` validé avec code 0.


---

## STEP S1-C: Sécurisation des Paiements et Webhooks

### Ce qui n'allait pas (Vulnérabilités critiques)
1. **Simulation automatique en production en l'absence de clés** :
   - Dans `src/lib/payments/kobara.ts`, le constructeur basculait automatiquement en mode simulation (`isMock = true`) dès que `KOBARA_SECRET_KEY` était absente ou préfixée par `mock_`. En production, un défaut de configuration créait des paiements simulés sans jamais refuser la transaction.
2. **Vulnérabilité aux attaques par temporisation et absence de vérification temporelle sur les webhooks** :
   - `verifyWebhookSignature` n'utilisait pas de comparaison en temps constant contre les attaques temporelles, et ne validait pas l'en-tête d'horodatage (`timestamp`), ouvrant la voie à des attaques par rejeu.
3. **Sélection arbitraire du dernier paiement en base de données** :
   - Dans `src/app/api/webhooks/kobara/route.ts`, si un webhook ne contenait ni `order_id` ni `payment_id`, le code exécutait une requête `.order("created_at", { ascending: false }).limit(1)` et validait aveuglément le paiement le plus récent de la base ! Un attaquant pouvait envoyer un événement tronqué pour faire valider la commande d'une autre personne.
4. **Mises à jour fractionnées sans verrouillage transactionnel** :
   - La validation effectuait des `update` indépendants sur `payments` et `orders` sans verrouillage de ligne (`FOR UPDATE`) ni validation atomique du montant exact ou de la devise (HTG).
5. **Altération d'état par paramètres de requête sur la route de retour** :
   - `src/app/api/payments/kobara/return/route.ts` acceptait `status=failed` depuis l'URL et marquait la commande et le paiement comme échoués directement en base. N'importe qui pouvait annuler la commande d'un tiers en visitant l'URL avec son `orderId`. De même, la page de confirmation affichait le statut "succès" sur la simple présence de `?status=success`.
6. **Stockage en clair de données sensibles dans `payments.raw`** :
   - Numéros de téléphone complets et jetons pouvaient être persistés sans masquage.

### Ce qui a été modifié
1. **Principe "Fail Closed" en production (`src/lib/payments/kobara.ts`)** :
   - `isMock` est désormais strictement conditionné par `isDemoMode()` (`APP_MODE=demo` et environnement non-production).
   - En production ou sans mode démo, `createPayment` et `verifyPayment` lèvent une exception bloquante si `KOBARA_SECRET_KEY` est absente.
   - `verifyWebhookSignature` lève une exception bloquante si `KOBARA_WEBHOOK_SECRET` est absent.
2. **Vérification cryptographique HMAC-SHA256 en temps constant** :
   - Utilisation de `crypto.timingSafeEqual` sur le corps brut de la requête (`rawBody`), avant tout parsing JSON.
   - Vérification de la fenêtre de tolérance temporelle de 5 minutes (300 secondes) contre les attaques par rejeu.
3. **Validation transactionnelle atomique en base de données** :
   - Nouvelle migration `supabase/migrations/20250119000000_transactional_payment_validation.sql` :
     - Création d'un index unique partiel : `UNIQUE(provider, provider_txn_id)` sur les paiements validés non vides.
     - Création de la fonction RPC `validate_payment_transactional(p_payment_id, p_provider_txn_id, p_expected_amount_htg, p_admin_id, p_note, p_metadata)` :
       - Verrouillage exclusif des lignes `payments` et `orders` via `FOR UPDATE`.
       - Vérification stricte du statut de départ (`pending` ou `awaiting_validation`).
       - Vérification exacte du montant en HTG (`p_expected_amount_htg = amount_htg`).
       - Vérification d'unicité du code de transaction contre toute collision.
       - Mise à jour atomique du paiement à `validated` et de la commande à `paid`.
       - Création idempotente de l'inscription (`enrollments`) via `ON CONFLICT DO NOTHING`.
       - Incrémentation atomique du compteur de coupon le cas échéant.
       - Enregistrement immédiat de l'audit log dans `admin_audit_logs`.
4. **Sécurisation du Webhook Kobara (`src/app/api/webhooks/kobara/route.ts`)** :
   - Rejet immédiat (HTTP 400) de tout événement dépourvu de `provider_transaction_id` ou d'identifiant de commande.
   - Rejet de toute devise différente de HTG.
   - Recherche stricte de la commande par ID ou référence (aucun repli sur "dernier paiement").
   - Idempotence : si le paiement est déjà validé, réponse HTTP 200 immédiate sans réexécution.
   - Appel exclusif de la fonction RPC transactionnelle `validate_payment_transactional`.
5. **Neutralisation de la route de retour (`src/app/api/payments/kobara/return/route.ts`)** :
   - Suppression totale des mutations de statut basées sur les paramètres de requête.
   - La route redirige uniquement l'apprenant vers la page de confirmation, laquelle lit le statut réel en base de données.
   - Suppression du paramètre de complaisance `?status=success` dans `ConfirmationPage`.
6. **Sécurisation de la validation manuelle NatCash (`src/app/actions/admin-payments.ts`)** :
   - `validatePaymentAction` s'appuie désormais sur la même RPC transactionnelle `validate_payment_transactional` avec consignation de l'`admin.id`.
7. **Masquage des données sensibles (`src/lib/payments/mask.ts`)** :
   - Masquage automatique des numéros de téléphone (`+509 38** **12`) et caviardage des jetons/mots de passe (`[REDACTED]`) dans tous les objets enregistrés dans `payments.raw` et les journaux d'audit.

### Comment cela a été vérifié
- **Test automatisé (`tests/step-s1c-payments.test.ts`)** :
  1. *Masquage des données* : vérification du caviardage de `token`, `api_key`, `authorization`, `password` et du masquage des numéros de téléphone.
  2. *Fail Closed en production* : vérification que l'absence de `KOBARA_SECRET_KEY` ou `KOBARA_WEBHOOK_SECRET` hors mode démo lève des erreurs explicites bloquantes.
  3. *Vérification cryptographique et tolérance d'horodatage* : validation de signatures valides, rejet des signatures altérées (1 octet modifié) et rejet des horodatages obsolètes (> 5 minutes).
  4. *Conformité de la migration SQL* : présence de `FOR UPDATE`, vérification de montant, unicité d'index et traçabilité d'audit.
- **Typecheck** : `npm run typecheck` validé sans aucune erreur.

---

## STEP S1-D: Élimination des Données Simulées des Chemins de Production

### Ce qui n'allait pas (Vulnérabilités de haute gravité)
1. **Repli silencieux sur des fixtures fictives en production** :
   - `src/lib/admin/payments.ts` renvoyait des transactions fictives (Esther Moïse, Wideline Saintil, etc.) et des KPI fictifs (38 000 HTG) si la base de données était vide ou en cas d'erreur de requête.
   - `src/lib/messaging/data.ts` renvoyait de fausses conversations mockées (`conv-001`, `conv-002`) et un badge trompeur de 1 message non lu.
   - `src/lib/admin/instructors.ts` renvoyait 3 faux formateurs mockés si la table était vide.
   - `src/lib/admin/students.ts`, `src/lib/admin/promotions.ts` et `src/lib/admin/messages.ts` retournaient également des données statiques en cas d'absence de données.
2. **Erreur de schéma SQL masquée provoquant le basculement systématique sur les mocks** :
   - Dans `src/lib/messaging/data.ts` et `src/app/actions/private-messaging.ts`, 5 requêtes joignaient `courses(title)` et `courses(id, title, description)`. Or la table `courses` ne possède ni colonne `title` ni colonne `description` (elle utilise `title_fr`, `title_ht`, `description_fr`, `description_ht`). PostgreSQL levait systématiquement une erreur, attrapée par `catch {}`, provoquant le repli aveugle sur le store en mémoire.
3. **Création de formateur corrompue et simulation in-memory** :
   - Dans `src/app/actions/admin-instructors.ts`, `createInstructorAction` tentait d'insérer directement dans `public.profiles` sans compte d'authentification Supabase Auth (`auth.users`), violant la clé étrangère `profiles.id -> auth.users.id`. En cas d'erreur, l'action capturait l'exception et ajoutait le formateur dans `globalThis.__mockInstructorsStore`, simulant un succès sans persistance réelle.
4. **Présence fictive et compteurs artificiels dans la communauté** :
   - `src/lib/community/data.ts` affichait un plancher artificiel de 142 membres en ligne (`onlineCount = 142`), gonflait le nombre de membres de 2500 (`totalMembers = count + 2500`), et simulait un faux badge de 12 messages non lus.
5. **Stores en mémoire non persistants (`globalThis`) interceptant les écritures** :
   - Plusieurs actions (`admin-moderation.ts`, `private-messaging.ts`) capturaient silencieusement les erreurs de base de données pour écrire dans `globalThis`, donnant l'illusion d'une action réussie sans persistance en base.

### Ce qui a été modifié
1. **Élimination des fixtures dans les chemins de production** :
   - Dans `src/lib/admin/payments.ts` : en production, `getAdminPaymentsKPIs()` renvoie des zéros stricts (`totalValidated: 0`, etc.) et `getAdminPaymentsList()` renvoie un tableau vide `[]`. Les fixtures ne sont activées que si `isDemoMode()` est vrai.
   - Dans `src/lib/messaging/data.ts` : les fonctions `getStudentConversations()`, `getStaffConversations()`, `getConversationById()`, `getConversationMessages()`, `getStudentEnrolledCourses()` et `getUnreadPrivateMessagesCount()` interrogent la vraie base de données et renvoient les états vides authentiques (`[]`, `0`).
   - Dans `src/lib/community/data.ts` : suppression intégrale des planchers artificiels. Le nombre d'utilisateurs en ligne reflète la présence réelle (`last_seen_at >= 15 min`) ou `0`. Le badge non lu reflète le vrai décompte ou `0`. Les messages renvoient un état vide si aucun message n'existe.
   - Dans `src/lib/admin/instructors.ts`, `src/lib/admin/students.ts`, `src/lib/admin/promotions.ts`, `src/lib/admin/messages.ts`, `src/lib/admin/moderation.ts` : toutes les fixtures de repli ont été strictement encapsulées derrière `isDemoMode()`.
2. **Correction des requêtes sur le schéma réel `courses`** :
   - Remplacement de `courses(title)` et `courses(title, description)` par `courses(id, title_fr, title_ht, description_fr, description_ht)` dans `src/lib/messaging/data.ts` et `src/app/actions/private-messaging.ts`.
   - Utilisation des colonnes localisées `title_fr` et `title_ht` avec repli propre.
3. **Refonte de la création de formateur (`src/app/actions/admin-instructors.ts`)** :
   - Création d'un utilisateur réel dans Supabase Auth via `createAdminClient().auth.admin.createUser()`.
   - Récupération de l'UUID réel `authUser.user.id` pour `profiles.id`.
   - Attribution du rôle `'instructor'` via la fonction RPC sécurisée `set_user_role`.
   - Insertion dans `instructors` et consignation dans `admin_audit_logs`.
   - Suppression totale du fallback in-memory : toute erreur SQL ou d'authentification est renvoyée explicitement au client.
4. **Suppression de l'étouffement des erreurs d'écriture** :
   - Dans `src/app/actions/admin-moderation.ts` et `src/app/actions/private-messaging.ts`, toutes les opérations d'écriture (`update`, `insert`) vérifient le retour `error`. En production, aucune écriture échouée n'est silencieusement ignorée.

### Recensement et Justification des occurrences de `mock`, `fake`, `demo`, `fixture`, `globalThis`

| Fichier | Mot-clé / Occurrence | Rôle & Justification |
| :--- | :--- | :--- |
| `src/lib/config/index.ts` | `isDemoMode()`, `APP_MODE=demo` | **Garde-fou officiel** : lève une exception bloquante si activé en production (`NODE_ENV === 'production'`). |
| `src/lib/admin/payments.ts` | `getDemoPaymentsData()` | Données démo pour prévisualisation locale / Storybook, strictement conditionnées par `if (isDemoMode())`. |
| `src/lib/admin/instructors.ts` | `getDemoInstructors()` | Fixtures pour tests UI locaux / démo, strictement conditionnées par `if (isDemoMode())`. |
| `src/lib/admin/students.ts` | `initializeMockStudents()` | Fixtures pour tests UI locaux / démo, strictement conditionnées par `if (isDemoMode())`. |
| `src/lib/admin/promotions.ts` | `initializeFallbackStore()` | Fixtures pour tests UI locaux / démo, strictement conditionnées par `if (isDemoMode())`. |
| `src/lib/admin/messages.ts` | `initializeFallbackMessages()` | Fixtures pour tests UI locaux / démo, strictement conditionnées par `if (isDemoMode())`. |
| `src/lib/admin/moderation.ts` | `initializeMockModeration()` | Fixtures de modération pour prévisualisation, strictement conditionnées par `if (isDemoMode())`. |
| `src/lib/community/data.ts` | `getDemoCommunityMessages()` | Fixtures de communauté pour prévisualisation, strictement conditionnées par `if (isDemoMode())`. |
| `src/lib/messaging/data.ts` | `initializeMockMessaging()` | Fixtures de messagerie pour prévisualisation, strictement conditionnées par `if (isDemoMode())`. |
| `src/lib/video/mock-provider.ts` | `MockVideoProvider` | Fournisseur de streaming vidéo pour tests sans clé API BunnyStream, actif uniquement si `APP_MODE=demo`. |
| `tests/db-roles-and-rls.test.ts` | `mock_` | Valeurs de test pour tester la résistance du système en l'absence de serveur distant. |

### Comment cela a été vérifié
- **Test automatisé (`tests/step-s1d-data-integrity.test.ts`)** :
  1. *Chemins de production* : vérification que lorsque `APP_MODE` n'est pas `demo`, les fonctions retournent des états vides (`0`, `[]`), et jamais de données mockées.
  2. *Conditionnement démo* : vérification que les fixtures sont accessibles uniquement lorsque `APP_MODE=demo` en non-production.
  3. *Intégrité des requêtes SQL* : confirmation statique et dynamique de l'absence de toute requête sur `courses(title)` et validation des colonnes réelles `title_fr`, `title_ht`.
  4. *Création formateur* : vérification que `createInstructorAction` utilise `auth.admin.createUser` et `set_user_role` sans store de repli.
- **Suite de tests globale** : exécution simultanée de `tests/step-s1a-identity.test.ts`, `tests/step-s1c-payments.test.ts` et `tests/step-s1d-data-integrity.test.ts` avec 100% de succès.
- **Typecheck** : `npm run typecheck` validé avec code 0.

---

## STEP S1-F: Récupération de Compte, Anti-Abus, Protection Cron, Documentation et Tests

### Ce qui n'allait pas (Vulnérabilités de moyenne à haute gravité)
1. **Absence d'interface dédiée pour la réinitialisation de mot de passe (`reinitialiser-mot-de-passe`)** :
   - L'API `src/app/api/auth/forgot-password/route.ts` redirigeait vers `/reinitialiser-mot-de-passe`, mais la page n'existait pas sous `src/app/[locale]/(auth)`. Un utilisateur cliquant sur le lien reçu par e-mail atterrissait sur une page 404.
2. **Absence de vérification cryptographique et contournement d'authentification sur la tâche Cron** :
   - Dans `src/app/api/cron/escalations/route.ts`, l'accès était accordé sans vérification si `process.env.NODE_ENV !== "production"`.
   - La comparaison de secret utilisait l'opérateur d'égalité stricte JavaScript `===`, vulnérable aux attaques par analyse temporelle (*timing attack*).
   - Un secret de secours statique et prévisible (`"faro-cron-secret-key"`) était utilisé par défaut.
   - En l'absence de secret en production, la tâche s'exécutait ou échouait sans log explicite de mauvaise configuration.
3. **Risque d'énumération par force brute sur les coupons promotionnels** :
   - La route `src/app/api/coupons/validate/route.ts` n'appliquait aucune limitation de débit (*rate limiting*), permettant à un attaquant de tester des milliers de codes promo par minute.
4. **Absence de commande de vérification globale unifiée** :
   - Les différents scripts de test et de validation de types étaient disséminés sans commande unique permettant d'attester l'intégrité de l'ensemble du système avant un déploiement.

### Ce qui a été modifié
1. **Implémentation complète de la réinitialisation de mot de passe** :
   - Création du composant client `src/components/auth/ResetPasswordForm.tsx` :
     - Écoute active de l'événement Supabase Auth `PASSWORD_RECOVERY` via `onAuthStateChange` et échange automatique de code PKCE via `exchangeCodeForSession(code)`.
     - Détection des sessions expirées ou invalides et affichage d'un état d'erreur clair invitant à redemander un lien, évitant toute confusion.
     - Schéma de validation Zod `updatePasswordSchema` dans `src/lib/validators/auth.ts` exigeant au moins 8 caractères et une confirmation identique (`password === confirmPassword`).
     - Mise à jour sécurisée du mot de passe via `supabase.auth.updateUser({ password })`.
     - Support bilingue intégral Français et Créole Haïtien (`src/messages/fr.json` et `src/messages/ht.json`).
   - Création de la page `src/app/[locale]/(auth)/reinitialiser-mot-de-passe/page.tsx` avec génération des métadonnées SEO.
   - Export du composant dans `src/components/auth/index.ts`.
2. **Durcissement cryptographique de la tâche Cron (`src/app/api/cron/escalations/route.ts`)** :
   - Principe *Fail Closed* : rejet immédiat avec statut HTTP 500 et log explicite si `CRON_SECRET` n'est pas configuré en production.
   - Suppression du secret par défaut en dur et suppression du bypass inconditionnel en environnement non-production.
   - Comparaison en temps constant via `crypto.timingSafeEqual` pour empêcher toute attaque temporelle sur l'en-tête `Authorization: Bearer <token>` ou `X-Cron-Secret: <token>`.
   - Encapsulation des vérifications de stores de repli strictement derrière `isDemoMode()`.
3. **Limitation de débit sur la validation des codes promo (`src/app/api/coupons/validate/route.ts`)** :
   - Ajout d'une limitation de 10 requêtes par fenêtre de 5 minutes par adresse IP via `checkRateLimit("coupon:${ip}", 10, 5 * 60 * 1000)`.
4. **Suite de tests d'audit étendue et commande `pnpm verify`** :
   - Extension de `tests/security-audit.ts` de 40 à 66 assertions automatisées couvrant toutes les étapes de durcissement.
   - Création du runner global `tests/run-all-tests.ts` et du test unitaire `tests/step-s1f-audit.test.ts`.
   - Ajout de la commande `pnpm verify` dans `package.json` enchaînant `typecheck`, `test:db`, `audit`, et l'intégralité des 7 suites de test.
5. **Mise à jour de la documentation** :
   - Mise à jour de `README.md` (tableau des variables d'environnement de production obligatoires, fonctionnement du mode démo, et instructions de déploiement).
   - Mise à jour de `PROJECT_CONTEXT.md` avec la synthèse du durcissement sécuritaire.

### Comment cela a été vérifié
- **Test unitaire (`tests/step-s1f-audit.test.ts`)** :
  1. *Validation Zod* : confirmation de l'acceptation des mots de passe conformes et du rejet des mots de passe trop courts ou divergents.
  2. *Limitation de débit* : vérification du blocage strict à la 6ème tentative sur une limite de 5 requêtes.
  3. *Vérification cryptographique en temps constant* : validation des secrets identiques, rejet des secrets erronés et rejet des écarts de longueur de chaîne.
- **Suite d'audit complète (`pnpm audit`)** : 66/66 assertions réussies.
- **Pipeline de vérification unifié (`pnpm verify`)** : 7/7 suites de test réussies, 0 erreur de type TypeScript.

---

## Checklist de Déploiement en Production

Avant toute mise en production sur Vercel ou Cloudflare Workers, assurez-vous d'avoir exécuté et vérifié les éléments suivants :

### 1. Variables d'Environnement Obligatoires
- [ ] `NODE_ENV=production`
- [ ] `APP_MODE` : **NE DOIT PAS** être défini sur `demo` (le système lève une exception bloquante au démarrage si `APP_MODE=demo` en production).
- [ ] `NEXT_PUBLIC_SUPABASE_URL` : URL de votre projet Supabase de production (`https://<projet>.supabase.co`).
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` : Clé publique anonyme du projet Supabase.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` : Clé secrète de rôle de service Supabase (accès privilégié serveur uniquement).
- [ ] `KOBARA_SECRET_KEY` : Clé secrète de production Kobara (`kobara_sk_live_...`).
- [ ] `KOBARA_WEBHOOK_SECRET` : Clé secrète HMAC configurée sur le webhook Kobara.
- [ ] `ANTHROPIC_API_KEY` : Clé secrète d'API Claude (Anthropic).
- [ ] `CRON_SECRET` : Chaîne aléatoire à haute entropie (ex: 64 caractères hexadécimaux) pour autoriser les tâches cron.
- [ ] `BUNNY_API_KEY`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_AUTH_KEY` : Clés d'administration et de jeton Bunny Stream.
- [ ] `BUNNY_STORAGE_ACCESS_KEY`, `BUNNY_STORAGE_TOKEN_KEY` : Clés Bunny Storage.

### 2. Migrations PostgreSQL Supabase
Exécutez dans l'ordre chronologique les migrations suivantes dans le **SQL Editor** de Supabase :
1. `supabase/migrations/20250101000000_initial_schema.sql` (schéma initial et tables RLS)
2. `supabase/migrations/20250108000000_admin_payments_and_audit_logs.sql` (audit logs et paiements)
3. `supabase/migrations/20250118000000_role_security_and_privilege_guards.sql` (trigger d'inscription `handle_new_user`, trigger `trg_protect_profile_privileged_fields`, révocation des droits `anon`, fonction RPC `set_user_role`)
4. `supabase/migrations/20250119000000_transactional_payment_validation.sql` (fonction RPC `validate_payment_transactional`, index unique `(provider, provider_txn_id)`)
5. `supabase/migrations/20250120000000_ai_usage_and_governance.sql` (colonnes `cost_usd`, `user_id`, RPC `check_ai_limits` et `record_ai_usage`, initialisation `ai_global_settings`)

### 3. Configuration des Webhooks Kobara
- [ ] Rendez-vous dans le tableau de bord Kobara > Paramètres Webhooks.
- [ ] Déclarez l'URL : `https://<votre-domaine>/api/webhooks/kobara`.
- [ ] Sélectionnez l'événement : `payment.succeeded`.
- [ ] Récupérez le secret de signature généré et assignez-le à `KOBARA_WEBHOOK_SECRET`.

### 4. Configuration du Déclencheur Cron (Escalades Pédagogiques)
- [ ] Configurez un appel HTTP récurrent (toutes les 1 ou 2 minutes) vers `https://<votre-domaine>/api/cron/escalations`.
- [ ] Configurez l'en-tête HTTP : `Authorization: Bearer <votre-CRON_SECRET>` ou `X-Cron-Secret: <votre-CRON_SECRET>`.

---

## Rapport d'Audit Final par Sévérité

### Statut des Vulnérabilités Auditées

#### 1. Corrigé (`Fixed`)

| Vulnérabilité / Risque | Gravité Initiale | Étape de Correction | Solution Appliquée |
| :--- | :---: | :---: | :--- |
| **Contournement d'identité par cookie non signé `faro_session`** | Critique | S1-A | Cookie supprimé. L'identité dépend exclusivement de `supabase.auth.getUser()`. Le rôle est lu depuis `profiles.role` en base de données. |
| **Mots de passe codés en dur (`Admin123!`, etc.) et repli d'inscription** | Critique | S1-A | Mots de passe en dur éliminés. Authentification obligatoire via Supabase Auth. Replis factices supprimés. |
| **Élévation de privilèges à l'inscription via `raw_user_meta_data->>'role'`** | Critique | S1-B | Trigger `handle_new_user` réécrit : force inconditionnellement le rôle `student`. Métadonnées ignorées. |
| **Mise à jour non autorisée de `profiles.role` via politique RLS permissive** | Critique | S1-B | `REVOKE UPDATE (role) ON profiles`. Trigger bloquant `trg_protect_profile_privileged_fields`. Fonction RPC d'élévation `set_user_role` réservée aux administrateurs. |
| **Permissions d'écriture excessives accordées au rôle public `anon`** | Haute | S1-B | `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon`. |
| **Simulation silencieuse des paiements en production en cas de clé manquante** | Critique | S1-C | Principe *Fail Closed* : le système lève une exception bloquante sans `KOBARA_SECRET_KEY` ou `KOBARA_WEBHOOK_SECRET` hors mode démo explicite. |
| **Attaque temporelle et rejeu sur la signature des webhooks de paiement** | Critique | S1-C | Vérification HMAC SHA-256 en temps constant via `crypto.timingSafeEqual` sur le corps brut avec tolérance d'horodatage stricte de 5 minutes. |
| **Validation aveugle du "dernier paiement" en base lors d'événements tronqués** | Critique | S1-C | Requête de complaisance `.order("created_at").limit(1)` supprimée. Rejet strict si identifiant de commande absent. |
| **Condition de concurrence et double validation lors du paiement** | Haute | S1-C | Fonction RPC PostgreSQL `validate_payment_transactional` avec verrouillage de ligne `FOR UPDATE`, contrôle exact du montant en HTG, et index d'unicité partiel `(provider, provider_txn_id)`. |
| **Mutation de statut de commande via paramètre GET de retour (`?status=failed`)** | Haute | S1-C | Suppression totale de toute mutation d'état dans la route de retour. Statut piloté uniquement par la base de données. |
| **Affichage de fausses transactions et KPIs fictifs en production** | Haute | S1-D | Élimination des fixtures dans les chemins nominaux. Les fonctions renvoient des zéros et listes vides authentiques. Fixtures strictement isolées derrière `isDemoMode()`. |
| **Requêtes SQL corrompues sur la table `courses` provoquant un repli sur les mocks** | Haute | S1-D | Correction des 5 requêtes : remplacement des colonnes inexistantes `title`, `description` par les colonnes localisées réelles `title_fr`, `title_ht`. |
| **Création de formateurs sans compte d'authentification (`auth.users`)** | Haute | S1-D | Refonte avec `auth.admin.createUser`, association à l'UUID généré, et attribution du rôle par RPC sécurisée. Fallback in-memory supprimé. |
| **Compteurs artificiels gonflés dans la communauté (+2500 membres, 142 en ligne)** | Moyenne | S1-D | Planchers artificiels supprimés. Les compteurs reflètent strictement les données réelles de présence. |
| **Simulation aléatoire de réponses IA en production sans clé d'API** | Haute | S1-E | Principe *Fail Closed* : en l'absence de clé, l'IA refuse de générer des réponses fictives et bascule instantanément vers une escalade humaine vers le formateur. |
| **Plafonds de coût IA et quotas étudiants volatils contournables** | Haute | S1-E | Migration `ai_usage` avec suivi persistant de `cost_usd` et `user_id`. RPC atomique `check_ai_limits` calculant les quotas UTC réels en base. |
| **Absence de bouton d'arrêt d'urgence (*Kill Switch*) opérationnel sur l'IA** | Haute | S1-E | Vérification en temps réel (cache 30s) de `platform_settings.ai_global_settings.killSwitch` désactivant l'IA sur l'ensemble de la plateforme. |
| **Vulnérabilité aux injections de prompt et réponses non structurées de l'IA** | Moyenne | S1-E | Troncature stricte à 2 000 caractères, filtrage des motifs d'injection, règles système anti-divulgation, et validation du format de sortie via Zod. |
| **Page de réinitialisation de mot de passe inexistante (Erreur 404)** | Moyenne | S1-F | Page et composant `ResetPasswordForm` créés avec gestion des jetons de récupération, formulaire Zod avec confirmation de mot de passe, et états d'expiration (FR/KR). |
| **Bypass d'authentification et comparaison vulnérable sur la tâche Cron** | Haute | S1-F | Élimination du bypass hors production, validation par `crypto.timingSafeEqual`, et échec bloquant sans `CRON_SECRET`. |
| **Absence de limitation de débit sur les codes promotionnels** | Moyenne | S1-F | Limitation de débit (10 requêtes / 5 min par IP) appliquée sur `/api/coupons/validate`. |

---

#### 2. Partiellement Corrigé (`Partially Fixed`)

| Fonctionnalité | État Actuel & Mesures Déployées | Ce qui reste à parfaire |
| :--- | :--- | :--- |
| **Stockage en mémoire de la limitation de débit (`rate-limit.ts`)** | `rateLimitStore` (Map mémoire) protège efficacement contre le spam sur une même instance Edge/Node. | En environnement hautement distribué multi-régions (plusieurs workers Cloudflare sans KV partagé), les compteurs ne sont pas partagés entre nœuds distincts. Pour une protection absolue à large échelle, coupler avec Cloudflare Rate Limiting ou Upstash Redis. |
| **Mode Démo (`APP_MODE=demo`)** | Strictement interdit en production avec levée d'exception bloquante (`throw new Error`). | Nécessite la vigilance des opérateurs pour ne jamais configurer `APP_MODE=demo` dans les secrets de l'environnement de production. |

---

#### 3. Reste Ouvert / En Attente d'Infrastructure (`Still Open`)

| Élément | Raison / Dépendance Externe | Action Requise de l'Opérateur |
| :--- | :--- | :--- |
| **Clés secrètes des tiers (Kobara live, Anthropic, Bunny)** | Par conception sécuritaire, aucune clé réelle n'est présente dans le dépôt de code. | Injecter les variables réelles dans la console d'hébergement (Vercel ou Cloudflare Dashboard). |
| **Application des migrations SQL sur la base de production** | L'agent a créé et testé les fichiers SQL localement, mais n'a pas accès au serveur PostgreSQL distant de production. | Exécuter les 5 migrations SQL dans le SQL Editor de Supabase (ou via `supabase db push`). |

---

## Ce Que l'Utilisateur Doit Fournir

1. **Clés d'API réelles en production** :
   - `KOBARA_SECRET_KEY` (commençant par `kobara_sk_live_`) et `KOBARA_WEBHOOK_SECRET` depuis le tableau de bord Kobara.
   - `ANTHROPIC_API_KEY` depuis la console Anthropic.
   - `BUNNY_API_KEY`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_AUTH_KEY`, `BUNNY_STORAGE_ACCESS_KEY`, `BUNNY_STORAGE_TOKEN_KEY` depuis la console Bunny.net.
2. **Configuration du Webhook Kobara** :
   - Renseigner l'URL `https://<votre-domaine>/api/webhooks/kobara` dans la console Kobara et y rattacher le secret correspondant.
3. **Application des 5 migrations SQL** sur l'instance Supabase distante de production.

---

## Ce Qui N'a Pas Été Vérifié

1. **Appels réseau en direct vers les API tierces distantes** :
   - Les appels réels vers les serveurs de Kobara, d'Anthropic (Claude) et de Bunny.net n'ont pas été exécutés contre des serveurs de production distants, en raison de l'isolation du bac à sable de test et de l'absence intentionnelle de clés de production réelles dans l'environnement local.
   - *Mesure de garantie* : Toutes les interfaces, schémas de données, validations de signature HMAC, calculs de jetons et réactions d'échec ont été validés cryptographiquement et unitairement via les suites de tests dédiées.
2. **Comportement réseau multi-régions distribué** :
   - Le partage d'état de la limitation de débit en mémoire entre plusieurs nœuds géographiquement dispersés (non critique pour le MVP).


---

## STEP S1-E: Assistant IA, Gouvernance et Garde-Fous de Coût

### Ce qui n'allait pas (Vulnérabilités de haute gravité)
1. **Simulation automatique de réponses IA en production** :
   - `src/lib/messaging/ai-assistant.ts` basculait silencieusement sur une réponse simulée aléatoire (`"Bonjour ! Je suis l'assistant pédagogique..."`) dès que `ANTHROPIC_API_KEY` était absente ou invalide. En production, un défaut de configuration générait de fausses réponses sans jamais alerter ni escalader vers un formateur humain.
2. **Plafonds de coût et quotas étudiants non persistés (contournables)** :
   - Le suivi des jetons et la limitation de débit étaient stockés dans un tableau en mémoire volatile (`globalThis.__mockAiUsageStore`). Dans un environnement serverless (Vercel, Cloudflare) ou lors d'un redémarrage, la mémoire était réinitialisée, permettant le contournement illimité des quotas journaliers par étudiant et du plafond budgétaire de la plateforme.
3. **Absence de suivi financier réel en base de données** :
   - La table `ai_usage` ne stockait ni le coût réel en dollars (`cost_usd`) ni l'identifiant de l'étudiant (`user_id`).
4. **Divergence de configuration entre la supervision et le runtime IA** :
   - `src/app/actions/admin-supervision.ts` et `src/lib/admin/messaging-supervision.ts` utilisaient des clés et structures hétérogènes pour la configuration globale et le bouton d'arrêt d'urgence (*kill switch*).
5. **Vulnérabilité aux injections de prompt et absence de validation stricte du format de sortie** :
   - Aucune troncature d'entrée (risque de déni de service et d'explosion des coûts par injection de textes volumineux).
   - Aucun filtre préventif sur les tentatives d'extraction du prompt système ou de manipulation de prix/remboursements.
   - Parsing JSON sans schéma de validation strict Zod sur la réponse du modèle.

### Ce qui a été modifié
1. **Migration SQL `supabase/migrations/20250120000000_ai_usage_and_governance.sql`** :
   - Ajout des colonnes `user_id UUID REFERENCES public.profiles(id)` et `cost_usd NUMERIC(10,6) DEFAULT 0` sur `public.ai_usage`.
   - Indexation optimisée : `idx_ai_usage_user_created` et `idx_ai_usage_created_at`.
   - Fonction RPC atomique `public.check_ai_limits(p_student_id, p_daily_limit, p_daily_cost_cap_usd)` :
     - Vérifie le délai de refroidissement anti-spam (2 secondes minimum entre deux requêtes d'un même élève).
     - Calcule la consommation du jour UTC pour l'étudiant et compare au quota (`p_daily_limit`).
     - Calcule la dépense totale de la plateforme du jour UTC et compare au plafond budgétaire (`p_daily_cost_cap_usd`).
   - Fonction RPC atomique `public.record_ai_usage(p_student_id, p_model, p_input_tokens, p_output_tokens, p_cost_usd, p_response_time_ms, p_status)` : consigne de manière transactionnelle les métriques d'inférence.
   - Initialisation dans `public.platform_settings` de la configuration par défaut sous la clé `'ai_global_settings'`.
2. **Gouvernance et arrêt d'urgence dans `src/lib/messaging/ai-assistant.ts`** :
   - Principe *Fail Closed* : si `ANTHROPIC_API_KEY` est absente en production, le système refuse toute génération simulée et déclenche immédiatement une escalade propre vers un formateur humain avec message explicatif (`"Un formateur humain a été notifié"`).
   - Le bouton d'arrêt d'urgence (*Kill Switch*) est vérifié en temps réel (mise en cache maximale de 30 secondes en mémoire) depuis `platform_settings` (ou via variable d'environnement `DISABLE_AI=true` / `AI_ASSISTANT_ENABLED=false`). S'il est activé, l'IA est désactivée sur l'ensemble de la plateforme et toutes les questions sont directement dirigées vers les formateurs.
3. **Garde-fous de prompt et sécurité des entrées/sorties** :
   - Troncature stricte de la question à 2 000 caractères maximum.
   - Filtre d'entrée contre les injections courantes (*prompt injection*, extraction d'instructions système, requêtes sur les tarifs/remboursements non autorisées).
   - Règles système renforcées (*anti-leak*) : interdiction formelle de révéler le prompt système, interdiction de divulguer des informations sur d'autres apprenants ou sur les transactions financières.
   - Validation stricte du JSON de sortie de Claude via le schéma Zod `aiOutputSchema` (vérification de conformité des champs `confidence`, `suggest_escalation`, etc.).
4. **Calcul financier précis** :
   - Calcul du coût réel en USD selon la grille tarifaire officielle de Claude 3 Haiku ($0.25 par million de jetons en entrée, $1.25 par million de jetons en sortie).
   - Enregistrement immédiat dans `ai_usage.cost_usd`.
5. **Harmonisation de la supervision administrateur** :
   - `src/lib/admin/messaging-supervision.ts` et `src/app/actions/admin-supervision.ts` utilisent la clé unifiée `'ai_global_settings'`.
   - Les fixtures de repli sont strictement conditionnées par `isDemoMode()`.

### Comment cela a été vérifié
- **Test automatisé (`tests/step-s1e-ai-guardrails.test.ts`)** :
  1. *Fail Closed en production* : confirmation que sans clé d'API, le moteur ne renvoie aucune réponse factice et bascule en escalade humaine.
  2. *Arrêt d'urgence (Kill Switch)* : confirmation du blocage instantané de l'IA et de l'escalade vers les formateurs lorsque le kill switch est actif.
  3. *Validation Zod et calcul de coût* : validation du parsing Zod sur les réponses valides et rejet des structures corrompues, vérification du calcul exact des coûts en USD.
  4. *Conformité de la migration SQL* : validation de la présence de `cost_usd`, `user_id`, et des RPC atomiques `check_ai_limits` et `record_ai_usage`.
- **Typecheck** : `npm run typecheck` validé avec code 0.

---

## STEP S1-F: Récupération de Compte, Anti-Abus, Protection Cron, Documentation et Tests

### Ce qui n'allait pas (Vulnérabilités de moyenne à haute gravité)
1. **Absence d'interface dédiée pour la réinitialisation de mot de passe (`reinitialiser-mot-de-passe`)** :
   - L'API `src/app/api/auth/forgot-password/route.ts` redirigeait vers `/reinitialiser-mot-de-passe`, mais la page n'existait pas sous `src/app/[locale]/(auth)`. Un utilisateur cliquant sur le lien reçu par e-mail atterrissait sur une page 404.
2. **Absence de vérification cryptographique et contournement d'authentification sur la tâche Cron** :
   - Dans `src/app/api/cron/escalations/route.ts`, l'accès était accordé sans vérification si `process.env.NODE_ENV !== "production"`.
   - La comparaison de secret utilisait l'opérateur d'égalité stricte JavaScript `===`, vulnérable aux attaques par analyse temporelle (*timing attack*).
   - Un secret de secours statique et prévisible (`"faro-cron-secret-key"`) était utilisé par défaut.
   - En l'absence de secret en production, la tâche s'exécutait ou échouait sans log explicite de mauvaise configuration.
3. **Risque d'énumération par force brute sur les coupons promotionnels** :
   - La route `src/app/api/coupons/validate/route.ts` n'appliquait aucune limitation de débit (*rate limiting*), permettant à un attaquant de tester des milliers de codes promo par minute.
4. **Absence de commande de vérification globale unifiée** :
   - Les différents scripts de test et de validation de types étaient disséminés sans commande unique permettant d'attester l'intégrité de l'ensemble du système avant un déploiement.

### Ce qui a été modifié
1. **Implémentation complète de la réinitialisation de mot de passe** :
   - Création du composant client `src/components/auth/ResetPasswordForm.tsx` :
     - Écoute active de l'événement Supabase Auth `PASSWORD_RECOVERY` via `onAuthStateChange` et échange automatique de code PKCE via `exchangeCodeForSession(code)`.
     - Détection des sessions expirées ou invalides et affichage d'un état d'erreur clair invitant à redemander un lien, évitant toute confusion.
     - Schéma de validation Zod `updatePasswordSchema` dans `src/lib/validators/auth.ts` exigeant au moins 8 caractères et une confirmation identique (`password === confirmPassword`).
     - Mise à jour sécurisée du mot de passe via `supabase.auth.updateUser({ password })`.
     - Support bilingue intégral Français et Créole Haïtien (`src/messages/fr.json` et `src/messages/ht.json`).
   - Création de la page `src/app/[locale]/(auth)/reinitialiser-mot-de-passe/page.tsx` avec génération des métadonnées SEO.
   - Export du composant dans `src/components/auth/index.ts`.
2. **Durcissement cryptographique de la tâche Cron (`src/app/api/cron/escalations/route.ts`)** :
   - Principe *Fail Closed* : rejet immédiat avec statut HTTP 500 et log explicite si `CRON_SECRET` n'est pas configuré en production.
   - Suppression du secret par défaut en dur et suppression du bypass inconditionnel en environnement non-production.
   - Comparaison en temps constant via `crypto.timingSafeEqual` pour empêcher toute attaque temporelle sur l'en-tête `Authorization: Bearer <token>` ou `X-Cron-Secret: <token>`.
   - Encapsulation des vérifications de stores de repli strictement derrière `isDemoMode()`.
3. **Limitation de débit sur la validation des codes promo (`src/app/api/coupons/validate/route.ts`)** :
   - Ajout d'une limitation de 10 requêtes par fenêtre de 5 minutes par adresse IP via `checkRateLimit("coupon:${ip}", 10, 5 * 60 * 1000)`.
4. **Suite de tests d'audit étendue et commande `pnpm verify`** :
   - Extension de `tests/security-audit.ts` de 40 à 66 assertions automatisées couvrant toutes les étapes de durcissement.
   - Création du runner global `tests/run-all-tests.ts` et du test unitaire `tests/step-s1f-audit.test.ts`.
   - Ajout de la commande `pnpm verify` dans `package.json` enchaînant `typecheck`, `test:db`, `audit`, et l'intégralité des 7 suites de test.
5. **Mise à jour de la documentation** :
   - Mise à jour de `README.md` (tableau des variables d'environnement de production obligatoires, fonctionnement du mode démo, et instructions de déploiement).
   - Mise à jour de `PROJECT_CONTEXT.md` avec la synthèse du durcissement sécuritaire.

### Comment cela a été vérifié
- **Test unitaire (`tests/step-s1f-audit.test.ts`)** :
  1. *Validation Zod* : confirmation de l'acceptation des mots de passe conformes et du rejet des mots de passe trop courts ou divergents.
  2. *Limitation de débit* : vérification du blocage strict à la 6ème tentative sur une limite de 5 requêtes.
  3. *Vérification cryptographique en temps constant* : validation des secrets identiques, rejet des secrets erronés et rejet des écarts de longueur de chaîne.
- **Suite d'audit complète (`pnpm audit`)** : 66/66 assertions réussies.
- **Pipeline de vérification unifié (`pnpm verify`)** : 7/7 suites de test réussies, 0 erreur de type TypeScript.

---

## Checklist de Déploiement en Production

Avant toute mise en production sur Vercel ou Cloudflare Workers, assurez-vous d'avoir exécuté et vérifié les éléments suivants :

### 1. Variables d'Environnement Obligatoires
- [ ] `NODE_ENV=production`
- [ ] `APP_MODE` : **NE DOIT PAS** être défini sur `demo` (le système lève une exception bloquante au démarrage si `APP_MODE=demo` en production).
- [ ] `NEXT_PUBLIC_SUPABASE_URL` : URL de votre projet Supabase de production (`https://<projet>.supabase.co`).
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` : Clé publique anonyme du projet Supabase.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` : Clé secrète de rôle de service Supabase (accès privilégié serveur uniquement).
- [ ] `KOBARA_SECRET_KEY` : Clé secrète de production Kobara (`kobara_sk_live_...`).
- [ ] `KOBARA_WEBHOOK_SECRET` : Clé secrète HMAC configurée sur le webhook Kobara.
- [ ] `ANTHROPIC_API_KEY` : Clé secrète d'API Claude (Anthropic).
- [ ] `CRON_SECRET` : Chaîne aléatoire à haute entropie (ex: 64 caractères hexadécimaux) pour autoriser les tâches cron.
- [ ] `BUNNY_API_KEY`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_AUTH_KEY` : Clés d'administration et de jeton Bunny Stream.
- [ ] `BUNNY_STORAGE_ACCESS_KEY`, `BUNNY_STORAGE_TOKEN_KEY` : Clés Bunny Storage.

### 2. Migrations PostgreSQL Supabase
Exécutez dans l'ordre chronologique les migrations suivantes dans le **SQL Editor** de Supabase :
1. `supabase/migrations/20250101000000_initial_schema.sql` (schéma initial et tables RLS)
2. `supabase/migrations/20250108000000_admin_payments_and_audit_logs.sql` (audit logs et paiements)
3. `supabase/migrations/20250118000000_role_security_and_privilege_guards.sql` (trigger d'inscription `handle_new_user`, trigger `trg_protect_profile_privileged_fields`, révocation des droits `anon`, fonction RPC `set_user_role`)
4. `supabase/migrations/20250119000000_transactional_payment_validation.sql` (fonction RPC `validate_payment_transactional`, index unique `(provider, provider_txn_id)`)
5. `supabase/migrations/20250120000000_ai_usage_and_governance.sql` (colonnes `cost_usd`, `user_id`, RPC `check_ai_limits` et `record_ai_usage`, initialisation `ai_global_settings`)

### 3. Configuration des Webhooks Kobara
- [ ] Rendez-vous dans le tableau de bord Kobara > Paramètres Webhooks.
- [ ] Déclarez l'URL : `https://<votre-domaine>/api/webhooks/kobara`.
- [ ] Sélectionnez l'événement : `payment.succeeded`.
- [ ] Récupérez le secret de signature généré et assignez-le à `KOBARA_WEBHOOK_SECRET`.

### 4. Configuration du Déclencheur Cron (Escalades Pédagogiques)
- [ ] Configurez un appel HTTP récurrent (toutes les 1 ou 2 minutes) vers `https://<votre-domaine>/api/cron/escalations`.
- [ ] Configurez l'en-tête HTTP : `Authorization: Bearer <votre-CRON_SECRET>` ou `X-Cron-Secret: <votre-CRON_SECRET>`.

---

## Rapport d'Audit Final par Sévérité

### Statut des Vulnérabilités Auditées

#### 1. Corrigé (`Fixed`)

| Vulnérabilité / Risque | Gravité Initiale | Étape de Correction | Solution Appliquée |
| :--- | :---: | :---: | :--- |
| **Contournement d'identité par cookie non signé `faro_session`** | Critique | S1-A | Cookie supprimé. L'identité dépend exclusivement de `supabase.auth.getUser()`. Le rôle est lu depuis `profiles.role` en base de données. |
| **Mots de passe codés en dur (`Admin123!`, etc.) et repli d'inscription** | Critique | S1-A | Mots de passe en dur éliminés. Authentification obligatoire via Supabase Auth. Replis factices supprimés. |
| **Élévation de privilèges à l'inscription via `raw_user_meta_data->>'role'`** | Critique | S1-B | Trigger `handle_new_user` réécrit : force inconditionnellement le rôle `student`. Métadonnées ignorées. |
| **Mise à jour non autorisée de `profiles.role` via politique RLS permissive** | Critique | S1-B | `REVOKE UPDATE (role) ON profiles`. Trigger bloquant `trg_protect_profile_privileged_fields`. Fonction RPC d'élévation `set_user_role` réservée aux administrateurs. |
| **Permissions d'écriture excessives accordées au rôle public `anon`** | Haute | S1-B | `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon`. |
| **Simulation silencieuse des paiements en production en cas de clé manquante** | Critique | S1-C | Principe *Fail Closed* : le système lève une exception bloquante sans `KOBARA_SECRET_KEY` ou `KOBARA_WEBHOOK_SECRET` hors mode démo explicite. |
| **Attaque temporelle et rejeu sur la signature des webhooks de paiement** | Critique | S1-C | Vérification HMAC SHA-256 en temps constant via `crypto.timingSafeEqual` sur le corps brut avec tolérance d'horodatage stricte de 5 minutes. |
| **Validation aveugle du "dernier paiement" en base lors d'événements tronqués** | Critique | S1-C | Requête de complaisance `.order("created_at").limit(1)` supprimée. Rejet strict si identifiant de commande absent. |
| **Condition de concurrence et double validation lors du paiement** | Haute | S1-C | Fonction RPC PostgreSQL `validate_payment_transactional` avec verrouillage de ligne `FOR UPDATE`, contrôle exact du montant en HTG, et index d'unicité partiel `(provider, provider_txn_id)`. |
| **Mutation de statut de commande via paramètre GET de retour (`?status=failed`)** | Haute | S1-C | Suppression totale de toute mutation d'état dans la route de retour. Statut piloté uniquement par la base de données. |
| **Affichage de fausses transactions et KPIs fictifs en production** | Haute | S1-D | Élimination des fixtures dans les chemins nominaux. Les fonctions renvoient des zéros et listes vides authentiques. Fixtures strictement isolées derrière `isDemoMode()`. |
| **Requêtes SQL corrompues sur la table `courses` provoquant un repli sur les mocks** | Haute | S1-D | Correction des 5 requêtes : remplacement des colonnes inexistantes `title`, `description` par les colonnes localisées réelles `title_fr`, `title_ht`. |
| **Création de formateurs sans compte d'authentification (`auth.users`)** | Haute | S1-D | Refonte avec `auth.admin.createUser`, association à l'UUID généré, et attribution du rôle par RPC sécurisée. Fallback in-memory supprimé. |
| **Compteurs artificiels gonflés dans la communauté (+2500 membres, 142 en ligne)** | Moyenne | S1-D | Planchers artificiels supprimés. Les compteurs reflètent strictement les données réelles de présence. |
| **Simulation aléatoire de réponses IA en production sans clé d'API** | Haute | S1-E | Principe *Fail Closed* : en l'absence de clé, l'IA refuse de générer des réponses fictives et bascule instantanément vers une escalade humaine vers le formateur. |
| **Plafonds de coût IA et quotas étudiants volatils contournables** | Haute | S1-E | Migration `ai_usage` avec suivi persistant de `cost_usd` et `user_id`. RPC atomique `check_ai_limits` calculant les quotas UTC réels en base. |
| **Absence de bouton d'arrêt d'urgence (*Kill Switch*) opérationnel sur l'IA** | Haute | S1-E | Vérification en temps réel (cache 30s) de `platform_settings.ai_global_settings.killSwitch` désactivant l'IA sur l'ensemble de la plateforme. |
| **Vulnérabilité aux injections de prompt et réponses non structurées de l'IA** | Moyenne | S1-E | Troncature stricte à 2 000 caractères, filtrage des motifs d'injection, règles système anti-divulgation, et validation du format de sortie via Zod. |
| **Page de réinitialisation de mot de passe inexistante (Erreur 404)** | Moyenne | S1-F | Page et composant `ResetPasswordForm` créés avec gestion des jetons de récupération, formulaire Zod avec confirmation de mot de passe, et états d'expiration (FR/KR). |
| **Bypass d'authentification et comparaison vulnérable sur la tâche Cron** | Haute | S1-F | Élimination du bypass hors production, validation par `crypto.timingSafeEqual`, et échec bloquant sans `CRON_SECRET`. |
| **Absence de limitation de débit sur les codes promotionnels** | Moyenne | S1-F | Limitation de débit (10 requêtes / 5 min par IP) appliquée sur `/api/coupons/validate`. |

---

#### 2. Partiellement Corrigé (`Partially Fixed`)

| Fonctionnalité | État Actuel & Mesures Déployées | Ce qui reste à parfaire |
| :--- | :--- | :--- |
| **Stockage en mémoire de la limitation de débit (`rate-limit.ts`)** | `rateLimitStore` (Map mémoire) protège efficacement contre le spam sur une même instance Edge/Node. | En environnement hautement distribué multi-régions (plusieurs workers Cloudflare sans KV partagé), les compteurs ne sont pas partagés entre nœuds distincts. Pour une protection absolue à large échelle, coupler avec Cloudflare Rate Limiting ou Upstash Redis. |
| **Mode Démo (`APP_MODE=demo`)** | Strictement interdit en production avec levée d'exception bloquante (`throw new Error`). | Nécessite la vigilance des opérateurs pour ne jamais configurer `APP_MODE=demo` dans les secrets de l'environnement de production. |

---

#### 3. Reste Ouvert / En Attente d'Infrastructure (`Still Open`)

| Élément | Raison / Dépendance Externe | Action Requise de l'Opérateur |
| :--- | :--- | :--- |
| **Clés secrètes des tiers (Kobara live, Anthropic, Bunny)** | Par conception sécuritaire, aucune clé réelle n'est présente dans le dépôt de code. | Injecter les variables réelles dans la console d'hébergement (Vercel ou Cloudflare Dashboard). |
| **Application des migrations SQL sur la base de production** | L'agent a créé et testé les fichiers SQL localement, mais n'a pas accès au serveur PostgreSQL distant de production. | Exécuter les 5 migrations SQL dans le SQL Editor de Supabase (ou via `supabase db push`). |

---

## Ce Que l'Utilisateur Doit Fournir

1. **Clés d'API réelles en production** :
   - `KOBARA_SECRET_KEY` (commençant par `kobara_sk_live_`) et `KOBARA_WEBHOOK_SECRET` depuis le tableau de bord Kobara.
   - `ANTHROPIC_API_KEY` depuis la console Anthropic.
   - `BUNNY_API_KEY`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_AUTH_KEY`, `BUNNY_STORAGE_ACCESS_KEY`, `BUNNY_STORAGE_TOKEN_KEY` depuis la console Bunny.net.
2. **Configuration du Webhook Kobara** :
   - Renseigner l'URL `https://<votre-domaine>/api/webhooks/kobara` dans la console Kobara et y rattacher le secret correspondant.
3. **Application des 5 migrations SQL** sur l'instance Supabase distante de production.

---

## Ce Qui N'a Pas Été Vérifié

1. **Appels réseau en direct vers les API tierces distantes** :
   - Les appels réels vers les serveurs de Kobara, d'Anthropic (Claude) et de Bunny.net n'ont pas été exécutés contre des serveurs de production distants, en raison de l'isolation du bac à sable de test et de l'absence intentionnelle de clés de production réelles dans l'environnement local.
   - *Mesure de garantie* : Toutes les interfaces, schémas de données, validations de signature HMAC, calculs de jetons et réactions d'échec ont été validés cryptographiquement et unitairement via les suites de tests dédiées.
2. **Comportement réseau multi-régions distribué** :
   - Le partage d'état de la limitation de débit en mémoire entre plusieurs nœuds géographiquement dispersés (non critique pour le MVP).


