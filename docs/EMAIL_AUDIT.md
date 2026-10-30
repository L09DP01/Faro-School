# Audit du système email Faro School

Base examinée : branche **auth-migration**, commit **c8d9bed**. Audit du dépôt, de la capture fournie et de vérifications publiques/Resend en lecture seule. La capture et son adresse personnelle ne sont pas recopiées dans ce rapport.

## Verdict

**Le système email est partiellement implémenté et ne permet pas actuellement de distinguer une demande acceptée d’un email réellement envoyé.** L’écran « un code a été envoyé » ne constitue pas une preuve d’envoi.

Le défaut principal est confirmé par exécution locale des véritables routes : **inscription et renvoi peuvent répondre HTTP 200 et afficher un succès alors que le transport échoue avant tout appel à Resend**. Le compteur de demandes est néanmoins augmenté. Cela reproduit précisément le symptôme de la capture et peut expliquer l’absence d’événement dans Resend, sans prouver à lui seul la cause de production.

La cause exacte sur le Worker déployé reste à confirmer : je n’ai ni ses secrets d’exécution ni ses logs privés, et je n’ai effectué aucune opération sur ta base Supabase. Les pistes prioritaires sont la présence/accessibilité de la table de suppression email, les secrets réellement disponibles dans le Worker et le compte/domaine utilisés par sa clé API.

## 1. Périmètre et preuves

### Effectué

- Lecture des routes d’authentification, des templates, du transport, des limites, des jetons, des webhooks, des actions formateurs/paiements/messagerie, des certificats, du contact, de la newsletter, des migrations et de la documentation.
- **14 reproductions locales** avec les véritables modules et gestionnaires HTTP ; I/O base et prestataire remplacées par des simulations. Résultats : [EMAIL_AUDIT_EVIDENCE.json](EMAIL_AUDIT_EVIDENCE.json).
- Vérifications DNS publiques et GET des pages publiques, sans inscription, renvoi, reset ou webhook POST en production.
- Un appel Resend **GET /domains uniquement**, avec la clé locale existante, sans afficher sa valeur.
- Signalement utilisateur pris en compte : **aucune tentative visible dans le tableau de bord Resend**. L’onglet exact — Emails ou Logs API — n’est pas confirmé.

### Non effectué

Aucun email réel envoyé. Aucun compte réel créé ou modifié. Aucune lecture ou écriture de la base Supabase distante. Aucune modification DNS, Resend, Cloudflare ou du code de production. Aucun correctif applicatif n’est présenté comme déjà implémenté dans cet audit.

### Résultats externes observés

| Contrôle | Observation | Interprétation exacte |
| --- | --- | --- |
| GET /fr/inscription | 200 | La page est accessible ; cela ne vérifie pas l’envoi. |
| GET /fr/verification-email | **404** | Le lien fabriqué pour les emails ne dispose pas de sa page de destination. |
| GET /api/webhooks/resend | 405 | Une route existe et refuse GET ; sa signature et son secret ne sont pas validés par ce contrôle. |
| DNS resend._domainkey.faroschool.com | TXT contenant une clé DKIM trouvé | Un enregistrement existe ; le statut du domaine dans le compte Resend n’est pas prouvé. |
| DNS send.faroschool.com | SPF trouvé | La configuration DNS n’est pas entièrement absente. |
| DNS _dmarc.faroschool.com | Non confirmé par le résolveur utilisé | À vérifier, mais cela n’explique pas un arrêt avant l’API Resend. |
| Resend GET /domains | 401, **restricted_api_key** | La clé utilisée ne permet pas de lire les domaines : c’est compatible avec une clé « Sending access ». **Ce résultat ne prouve pas qu’elle est invalide pour envoyer.** |

La clé et l’expéditeur sont renseignés localement ; cela ne prouve pas leur présence dans Cloudflare. Le secret webhook Resend est absent du fichier local examiné ; son état en production est inconnu. Ce secret sert aux callbacks et n’est pas consulté par le transport d’envoi.

## 2. Chaîne actuelle et point de rupture

1. Le formulaire appelle /api/auth/signup.
2. Le serveur crée le profil et les identifiants, ou retrouve un profil existant.
3. Il fabrique un code et un jeton de vérification.
4. Il appelle sendVerificationEmail → sendEmail → sendResendEmail.
5. Le transport vérifie RESEND_API_KEY et EMAIL_FROM.
6. Il lit **public.email_suppressions**, avec le client service_role.
7. Si tout est correct et l’adresse non bloquée, il appelle POST https://api.resend.com/emails.
8. La réponse du transport est retournée sous la forme success/error/id.
9. **La route ignore ce résultat**, comptabilise la demande et renvoie un succès.
10. Le formulaire affiche l’étape de vérification, avec la phrase affirmant l’envoi et un délai de renvoi de 60 secondes.

Si l’étape 5 ou 6 échoue, **l’étape 7 n’a jamais lieu** et aucun email ne peut apparaître dans Resend. Si l’étape 7 est rejetée, la route garde également son faux succès. Une acceptation API ne signifie par ailleurs pas une livraison en boîte de réception.

Auth.js avec Credentials ne prend pas en charge ces envois automatiquement. **Dans le code actuel, l’expéditeur est Resend ; Supabase fournit les données et les jetons applicatifs, pas Supabase Auth/SMTP.**

## 3. Constats classés par priorité

P0 = activation des comptes bloquée ou faux succès d’une fonction essentielle. P1 = correction nécessaire avant exploitation fiable. P2 = qualité, suivi ou amélioration opérationnelle.

### E01 — P0 — Faux succès des envois essentiels, reproduit

Sources : [signup:111](../src/app/api/auth/signup/route.ts#L111), [signup:196](../src/app/api/auth/signup/route.ts#L196), [resend-code:70](../src/app/api/auth/resend-code/route.ts#L70), [forgot-password:51](../src/app/api/auth/forgot-password/route.ts#L51), [RegisterForm:92](../src/components/auth/RegisterForm.tsx#L92).

Les appels attendent la promesse mais ne lisent jamais success/error. Le transport retourne un objet d’échec, il ne lève généralement pas d’exception. Les catch des routes ne sont donc pas déclenchés. Le renvoi affiche également un succès et réinitialise son délai.

**Reproduction :** erreur simulée de table de suppression → zéro appel Resend → HTTP 200, success=true, compteur augmenté pour signup, resend-code et forgot-password.

À corriger : distinguer demande acceptée, soumission au prestataire et livraison. Garder les réponses publiques neutres pour ne pas révéler si un compte existe — particulièrement pour « mot de passe oublié ». L’erreur exploitable doit être visible dans un suivi serveur/admin protégé, sans afficher les détails d’un destinataire dans une API publique.

### E02 — P0 — Dépendance SQL bloquante pour tous les emails

Source : [transport:17](../src/lib/email/transport.ts#L17). Migration : [20261030001418_bunny_resend_webhooks.sql](../supabase/migrations/20261030001418_bunny_resend_webhooks.sql).

Le contrôle des suppressions ajouté lors de l’implémentation des webhooks est désormais un préalable à **chaque** envoi, y compris les codes. Si la migration n’est pas appliquée, si l’URL pointe vers une autre base ou si service_role n’a pas accès, le transport renvoie email_unavailable sans appeler Resend. Une adresse bloquée renvoie email_suppressed, également sans appel.

**Le mécanisme est reproduit ; l’absence de cette table dans ta production n’a pas été vérifiée.** C’est la première vérification opérationnelle à faire. Ne pas supprimer la protection ni désactiver RLS pour masquer le problème.

### E03 — P1 — Les erreurs ne permettent pas de diagnostiquer la panne

Source : [transport:20](../src/lib/email/transport.ts#L20).

Un refus HTTP 403, une limite 429 et une panne 500 deviennent tous email_delivery. Une panne réseau, un timeout et une erreur de lecture SQL deviennent email_unavailable. Le statut HTTP, la catégorie sûre du prestataire et un identifiant de corrélation ne sont pas conservés. Les erreurs de configuration se perdent aussi dans les faux succès décrits plus haut.

À ajouter : catégories internes stables, statut HTTP prestataire, correlation_id, template_id, message_id et état. Ne pas logger corps email, adresse en clair, code, token, signature ou clé. Les erreurs brutes Resend ne doivent pas être renvoyées au navigateur.

### E04 — P1 — Configuration de production non attestée et documentation contradictoire

Sources : [env:70](../src/lib/env.ts#L70), [transport:8](../src/lib/email/transport.ts#L8), [ENVIRONMENT:57](ENVIRONMENT.md#L57).

Le dépôt contient une fonction validateEnvironment, mais l’audit des références ne trouve pas son raccordement à un point de démarrage ou son utilisation par le transport. Son existence et ses tests unitaires ne prouvent donc pas qu’un Worker refuse effectivement de démarrer sans clé email.

Le transport lit directement process.env. Sans clé en production, il retourne un échec ensuite ignoré. En développement sans clé, il retourne même success=true **sans envoi**, reproduit dans le diagnostic.

La documentation dit encore : « RESEND_API_KEY : Remplacé par les templates d’e-mail natifs de Supabase Auth ». **Cette instruction est fausse pour la version Auth.js actuelle** et peut conduire à omettre le secret nécessaire.

Vérifier les secrets **d’exécution du Worker**, pas seulement .env.local ou les variables du build. Valider aussi le format de EMAIL_FROM et l’absence d’espaces/retours à la ligne accidentels dans la clé. L’absence de RESEND_WEBHOOK_SECRET bloque le suivi webhook, pas directement POST /emails dans ce transport.

### E05 — P1 — Le lien de vérification arrive sur une page absente

Sources : [signup:110](../src/app/api/auth/signup/route.ts#L110), [signup:195](../src/app/api/auth/signup/route.ts#L195), [resend-code:69](../src/app/api/auth/resend-code/route.ts#L69).

Les emails pointent vers /[locale]/verification-email?token=…&email=…. Cette page n’existe pas dans le dépôt et **/fr/verification-email renvoie 404 en production**. L’API sait vérifier un token, mais aucune page ne relie ce lien à cette API. La voie principale par code reste distincte.

À implémenter en FR/KR : page publique de vérification du lien, état expiré/déjà utilisé, usage unique atomique, redirection relative sûre et connexion selon les règles prévues. Le token ne doit jamais être journalisé.

### E06 — P1 — Jetons générés malgré un échec SQL et consommation non atomique

Source : [tokens:29](../src/lib/auth/tokens.ts#L29), [tokens:192](../src/lib/auth/tokens.ts#L192).

La création invalide les anciens jetons et insère le nouveau sans contrôler les erreurs retournées. **Un échec d’insertion peut quand même produire code/token en retour**, reproduit. Le destinataire peut alors recevoir un code impossible à valider, ou perdre son ancien code sans en recevoir un nouveau.

La consommation, le compteur d’essais et la modification du profil reposent sur plusieurs lectures/écritures séparées. Le simple chemin séquentiel ne garantit pas cinq essais ni l’usage unique sous concurrence. Le code à six chiffres utilise **Math.random**, alors que le token de lien utilise crypto.getRandomValues. La comparaison de hash du code est une comparaison de chaînes ordinaire.

À corriger : génération cryptographique du code, contrôle de tous les résultats SQL, création/consommation transactionnelles, compteur atomique et comparaison appropriée. Aucun hash, code ou token ne doit devenir lisible par le navigateur hors saisie ou lien volontairement reçu par son propriétaire.

### E07 — P1 — Protection anti-spam incomplète

Sources : [rate-limit:49](../src/lib/auth/rate-limit.ts#L49), [signup:86](../src/app/api/auth/signup/route.ts#L86), [resend-code:47](../src/app/api/auth/resend-code/route.ts#L47).

- Des erreurs SQL retournées sont ignorées par les lectures ; les exceptions reviennent aussi à allowed=true sans condition effective de production. Le diagnostic reproduit une autorisation avec erreurs base.
- Vérifier puis incrémenter séparément ne réserve pas atomiquement le budget sous requêtes concurrentes. L’index auth_attempts n’est pas une garantie d’unicité des compteurs.
- L’alerte « inscription avec une adresse déjà vérifiée » contourne entièrement checkEmailDispatchLimit, confirmé à l’exécution. Elle peut servir à spammer un titulaire dès que l’envoi fonctionne.
- resend-code retourne alreadyVerified pour un compte vérifié, alors qu’un inconnu reçoit une réponse différente : information de compte exposée.
- Contact et newsletter utilisent une Map en mémoire, qui n’est pas une limite partagée fiable entre instances Workers.

À corriger : réservation transactionnelle par IP/adresse/type, traitement explicite des pannes, protection des alertes de sécurité et réponses publiques uniformes. Séparer **compteur anti-abus des demandes** et **preuve de livraison** ; compter une demande ratée peut être légitime pour l’anti-spam, mais ne permet pas d’affirmer un envoi.

### E08 — P1 — Invitations formateurs partiellement fonctionnelles

Sources : [admin-instructors:118](../src/app/actions/admin-instructors.ts#L118), [resend:159](../src/lib/email/resend.ts#L159), [reset-password:60](../src/app/api/auth/reset-password/route.ts#L60).

L’action ignore le résultat d’envoi et renvoie une création réussie. Elle force le français, malgré un template KR disponible. Le jeton est créé pour **48 h**, mais l’email annonce **72 h**.

Pour un nouveau formateur, l’action crée un profil sans créer ses user_credentials ; le reset effectue ensuite un UPDATE, sans UPSERT ni vérification du nombre de lignes modifiées. Ce parcours peut donc annoncer un mot de passe défini sans l’avoir enregistré. Une vérification complète du parcours d’invitation est nécessaire, au-delà de l’envoi.

### E09 — P1 — Escalade : destinataire et contenu à sécuriser

Sources : [private-messaging:713](../src/app/actions/private-messaging.ts#L713), [messaging/email:48](../src/lib/messaging/email.ts#L48).

Le destinataire provient de INSTRUCTOR_ESCALATION_EMAIL ou d’une adresse codée en dur, plutôt que de l’adresse d’escalade du formateur concerné. Cette variable n’est pas déclarée dans env.ts/.env.example. La langue vient de l’élève, pas forcément du destinataire.

Le nom, le sujet, la question et l’extrait de conversation sont interpolés sans échappement HTML. Le diagnostic confirme qu’un lien HTML contenu dans un message étudiant est intégré comme balise à l’email. Cela permet de l’injection de contenu/liens ; l’exécution de JavaScript dans un client email n’est pas affirmée.

Le message système annonce une notification avant le résultat d’envoi. Un échec reste pending et le cron actuel n’est pas un mécanisme de nouvelle tentative email : il poste surtout un suivi dans la conversation.

### E10 — P1 — Emails métier annoncés mais non implémentés

Source : [admin-payments:21](../src/app/actions/admin-payments.ts#L21).

notifyStudent est un **stub console.log**, même avec ENABLE_NOTIFICATION_DISPATCH=true. Il n’envoie ni email ni SMS. Le webhook Kobara valide les paiements mais ne déclenche pas d’email transactionnel. Contact et newsletter enregistrent des données sans envoi.

Il faut ajouter de véritables déclencheurs et templates, liés à un événement métier confirmé et dédupliqué côté serveur. Ajouter un template seul ne branche pas l’événement qui doit l’envoyer.

### E11 — P1 — Notifications de sécurité et changement d’adresse manquants

Source : [profile:12](../src/app/api/auth/profile/route.ts#L12).

Aucun parcours de vérification d’une nouvelle adresse n’est implémenté. Le changement de mot de passe du profil ne demande pas le mot de passe actuel dans son schéma et aucun email d’alerte ne suit un changement/reset réussi. Ces points sont importants pour la sécurité du système email/compte, mais ne constituent pas la cause démontrée de l’absence du premier code.

À ajouter : vérification de la nouvelle adresse avant remplacement, avertissement à l’ancienne, vérification du mot de passe actuel pour un changement authentifié et notification après la modification effective. Ne jamais envoyer le mot de passe lui-même.

### E12 — P1 — Pas de reprise durable ni de vue d’exploitation

Sources : [transport](../src/lib/email/transport.ts), [certificates/service:31](../src/lib/certificates/service.ts#L31), [webhook Resend](../src/app/api/webhooks/resend/route.ts).

Les envois sont synchrones et ne disposent pas de file durable ou de reprise automatique après timeout/429/5xx. Les certificats peuvent réessayer lors d’une nouvelle demande utilisateur, avec une clé d’idempotence : c’est un début, pas un worker de reprise.

Le message_id retourné par Resend n’est pas durablement associé aux événements applicatifs. email_deliveries suit des callbacks par ID prestataire/empreinte destinataire, mais ne montre pas les tentatives arrêtées **avant** Resend et ne relie pas clairement un échec à une inscription. Aucun tableau d’exploitation email n’est présent.

### E13 — P2 — Qualité des templates et suivi

Les templates essentiels sont globalement bilingues et légers, mais les erreurs serveur/interface ne sont pas toutes traduites. La plupart des emails n’ont pas de version texte. Le code de vérification apparaît dans le sujet, ce qui augmente son exposition dans notifications et outils de suivi ; le conserver uniquement dans le corps est préférable. L’email certificat échappe déjà son HTML, contrairement à d’autres templates.

Il manque une politique cohérente Reply-To pour le support, une gestion des préférences des emails optionnels et une séparation claire transactionnel/marketing. Un webhook de livraison ne doit jamais vérifier un compte : **ce point est correctement respecté** par le récepteur actuel.

## 4. Quels emails doivent être branchés ?

| Événement réel du projet | État actuel | Priorité / déclenchement recommandé |
| --- | --- | --- |
| Inscription, vérification initiale | Appel/template existants ; fiabilité défaillante | **P0**, rétablir la soumission réelle et un suivi fiable. |
| Renvoi de code | Existant ; faux succès et limites non atomiques | **P0**, respecter délai et budget, signaler les échecs en interne. |
| Mot de passe oublié | Existant ; résultat ignoré | **P0**, réponse publique générique, livraison suivie en privé. |
| Invitation formateur | Partiel, durée incohérente, FR forcé | **P1**, invitation dédupliquée et parcours set-password complet. |
| Tentative d’inscription d’une adresse déjà vérifiée | Template existant, pas de limite dédiée | **P1**, alerte limitée et générique. |
| Changement/reset de mot de passe réussi | Pas d’alerte email | **P1**, après transaction, sans secret dans le message. |
| Changement d’adresse email | Parcours absent | **P1**, code à la nouvelle adresse, avertissement à l’ancienne. |
| Paiement confirmé et accès accordé | Paiement validé, aucun email effectif | **P1**, confirmation/reçu avec lien protégé, une fois par événement. |
| Paiement rejeté | Stub de notification | **P1**, explication utilisable et lien vers une nouvelle démarche. |
| Remboursement ou accès révoqué | Pas de déclencheur email | **P1**, après état confirmé, sans divulgation de motif interne sensible. |
| Certificat délivré | Template/envoi présents, suivi partiel | **P1**, reprendre le suivi et les retries ; lien uniquement, pas de PDF public. |
| Certificat réémis/révoqué | Pas de notification dédiée | **P2**, prévenir le propriétaire avec le nouveau lien/état public approprié. |
| Message transféré au formateur hors ligne | Envoi présent, mauvais routage possible | **P1**, destinataire correct, HTML échappé et reprise. |
| Réponse privée à un élève hors ligne | Notifications dans l’app, pas d’email dédié identifié | **P2**, option configurable, délai/regroupement et déduplication. |
| Demande de contact reçue | Stockage DB seulement | **P1**, alerte support ; accusé optionnel seulement si contact est un email valide. |
| Newsletter | Stockage DB seulement | **P2**, confirmation d’abonnement, consentement, désabonnement et outil marketing adapté. |
| Bienvenue après vérification | Absent | **P2**, facultatif, après activation uniquement. |
| Formation publiée / nouveauté importante | Pas de campagne email | **P2**, abonnements/préférences et ciblage vérifié. |
| Échec d’encodage vidéo | État Bunny suivi, pas d’email | **P2**, alerte opérateur/formateur regroupée, pas à chaque résolution. |
| Message communautaire, chaque leçon terminée, présence en ligne | Pas d’email systématique | Conserver dans l’app ; digest ou mentions seulement sur préférence explicite. |

Ne pas ajouter des dizaines de notifications avant de réparer les trois premiers parcours. Les emails de marketing ne doivent pas partager sans distinction les règles et préférences des codes de sécurité.

## 5. Diagnostic production à effectuer en premier

### A. Worker Cloudflare — vérifications sans communiquer de secrets

1. Vérifier la branche et le commit réellement déployés. Une présence sur GitHub ne prouve pas le code exécuté par faroschool.com.
2. Dans les variables/secrets **du Worker exécuté**, vérifier la présence de RESEND_API_KEY, EMAIL_FROM, SUPABASE_SERVICE_ROLE_KEY et de la bonne URL Supabase. Ne fournir ni captures de clés ni valeurs dans le chat.
3. Vérifier que la clé appartient à la même équipe Resend que le dashboard consulté et autorise le domaine de EMAIL_FROM.
4. Dans Resend, consulter **Logs API** en plus de Emails : un refus avant acceptation peut ne pas apparaître comme email envoyé.
5. Chercher un identifiant de requête Cloudflare correspondant à la tentative. Le code actuel ne fournissant pas assez de diagnostics internes, l’absence de log ne prouve pas que le transport a réussi.

### B. Base — requêtes à exécuter toi-même, lecture seule

```sql
SELECT to_regclass('public.email_suppressions') AS suppressions,
       to_regclass('public.email_deliveries') AS deliveries,
       to_regclass('public.webhook_events') AS webhook_events,
       to_regclass('public.email_verification_tokens') AS verification_tokens,
       to_regclass('public.auth_attempts') AS auth_attempts;

SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       has_table_privilege('service_role', c.oid, 'SELECT') AS service_can_read
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('email_suppressions', 'email_deliveries',
                   'webhook_events', 'email_verification_tokens', 'auth_attempts');
```

Ces requêtes ne demandent aucun email, code ou hash d’utilisateur. Une table NULL ou absente des résultats signifie que le schéma attendu n’est pas disponible dans cette base. Vérifier notamment la migration 20261030001418_bunny_resend_webhooks.sql. Une lecture autorisée ne prouve pas à elle seule l’accès en écriture : contrôler les grants complets de la migration pour l’exploitation.

### C. Expéditeur

Vérifier le statut **Verified** du domaine exact dans l’équipe Resend concernée, les droits de la clé et ses limites. Les DNS publics observés ne remplacent pas ce contrôle. La clé locale est limitée à l’envoi ; il n’est pas nécessaire de l’élargir à Full access pour envoyer des emails. Les essais réels sur une adresse contrôlée devront être explicitement autorisés après correction ; aucun n’a été réalisé ici.

## 6. Plan d’implémentation proposé

### Lot 1 — Débloquer l’activation

- Contrôle privé de configuration et de schéma, avec diagnostic exploitable sans exposition de données.
- Corriger tous les résultats ignorés ; garder les réponses publiques anti-énumération.
- Refaire la persistance/consommation des codes atomiquement et brancher le lien FR/KR actuellement 404.
- Limites partagées et atomiques, incluant les alertes d’inscription d’un compte existant.
- Retirer la documentation Supabase Auth obsolète.

### Lot 2 — Fiabiliser les envois

- Ajouter une outbox privée PostgreSQL, avec RLS, droits serveur seuls, clés d’idempotence et états distincts : demande, en attente, acceptée par Resend, livrée, échec, bloquée.
- Worker/cron protégé pour retries bornés et backoff sur erreurs temporaires ; respecter Retry-After. Ne pas réessayer automatiquement les erreurs permanentes.
- Ne pas stocker en clair dans l’outbox un mot de passe, code ou token. Si un contenu secret doit survivre pour une reprise, prévoir un chiffrement serveur et une rétention courte ; sinon concevoir la génération au moment de la soumission avec des références sûres.
- Relier message_id et webhooks à l’événement applicatif. Une panne webhook ne doit pas empêcher de voir une tentative d’envoi.
- Ajouter une vue admin protégée : échecs par catégorie, dernier essai, compteur, destinataire masqué, reprise autorisée et auditée. Pas de corps email ni de code affiché.

### Lot 3 — Brancher les emails métier

Confirmer paiements/inscriptions, alertes de sécurité, invitations, contact et escalades. Déclencher les emails à partir de transactions serveur validées, pas d’un bouton navigateur ou d’un retour de paiement client. Réutiliser les tables métier existantes et les politiques de rôle.

### Lot 4 — Qualité et options

Unifier templates FR/KR, textes simples, échappement HTML, Reply-To, durées réelles et liens. Ajouter seulement ensuite newsletter, bienvenue et rappels optionnels avec préférences et déduplication.

## 7. Critères de validation avant de déclarer les emails opérationnels

- Une panne de configuration ou de table est visible dans le suivi privé ; aucune fausse preuve d’envoi n’est produite.
- Nouveau compte, compte non vérifié existant et renvoi : code utilisable, expiration et cinq essais effectifs sous concurrence.
- Lien email fonctionnel en FR/KR ; code utilisable dans la PWA, sans dépendre du navigateur externe.
- Destinataire inconnu/existant : réponses publiques génériques ; cooldown et plafonds atomiques, même en cas de requêtes simultanées.
- Invitation formateur : durée annoncée correcte, mot de passe réellement créé, connexion possible, langue correcte.
- Réinitialisation : mot de passe changé réellement, sessions anciennes invalidées, notification de sécurité.
- Succès API Resend enregistré avec message_id ; événements livré/rebond/plainte/suppression correctement rapprochés.
- 429/5xx/timeout : reprise bornée, sans duplication ni invalidation répétée de codes déjà acceptés.
- HTML étudiant échappé ; aucun code/token/secret dans les logs, l’interface admin ou les réponses publiques.
- Paiement et certificat : événement confirmé, email unique, aucun PDF nominatif publié.
- Recette réelle autorisée sur boîtes contrôlées, FR/KR, iPhone/Android et PWA. Les simulations locales ne prouvent pas la délivrabilité réelle.

## 8. Rejouer les preuves de cet audit

```text
node node_modules/tsx/dist/cli.mjs scripts/audit-email-offline.ts
```

Cet outil est un **diagnostic de l’état défaillant**, pas une suite donnant un feu vert de production : ses assertions démontrent les défauts observés. Il n’est pas ajouté à la CI et devra être adapté une fois ces défauts corrigés. Les appels réseau et la base y sont remplacés ; aucun email n’est envoyé et aucun compte réel n’est touché.

## Sources prestataires

- [Resend — envoi transactionnel et suivi](https://resend.com/docs/dashboard/emails/introduction).
- [Resend — domaines vérifiés](https://resend.com/docs/dashboard/domains/introduction).
- [Resend — erreurs, dont clé limitée à l’envoi](https://resend.com/docs/api-reference/errors).
- [Resend — clés API](https://resend.com/docs/dashboard/api-keys/introduction).
- [OpenNext — variables d’environnement build/runtime](https://opennext.js.org/cloudflare/howtos/env-vars).
- [Cloudflare — configuration Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
