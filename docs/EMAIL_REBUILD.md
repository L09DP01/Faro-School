# Refonte des parcours email — 30 octobre 2026

Le test Resend demandé a été reçu par le propriétaire. Il valide la clé et
l’expéditeur locaux, mais contourne la création de compte et la file de
production : il ne suffisait pas à valider l’inscription.

## Défauts corrigés

1. Le double appel du quota atomique empêchait les nouveaux comptes d’atteindre
   l’envoi. Corrigé précédemment dans `ae31991`.
2. L’appel SQL de création omettait `p_id`, obligatoire dans la migration Auth.js.
   Le contrat est maintenant respecté, y compris la réponse JSON `{ user_id }`.
3. Les insertions de secours non atomiques sont supprimées. Une erreur de RPC
   ne doit pas créer un profil incomplet ou modifier un compte existant.
4. Les trois routes publiques partageaient des contrôles et erreurs divergents.
   Elles utilisent désormais `src/lib/email/auth-requests.ts` : un quota par
   demande, sélection du type d’email, création atomique, puis file privée.
5. Les appels réseau à la base utilisés par les parcours email sont bornés à
   dix secondes. Les erreurs de préparation/file disposent d’une étape et d’un
   code technique autorisé dans les logs, sans message SQL ni données privées.
6. Les anciennes fonctions email inutilisées qui ignoraient les codes/liens
   passés en argument ont été retirées. Toutes les preuves sont préparées dans
   la file privée, avec les mêmes secrets lors d’une reprise.

## Architecture conservée et vérifiée

- Resend via `POST /emails`, avec clé d’idempotence stable par email.
- File privée, reprises bornées, matériel AES-GCM privé ; seuls les condensats
  des preuves servent à la vérification.
- Code à six chiffres, dix minutes, cinq tentatives, usage unique ; aucun login
  avant preuve. Les callbacks de livraison ne vérifient jamais le compte.
- Réponses publiques neutres et `Cache-Control: no-store`, sans session à
  l’inscription. Une réponse neutre signifie que la demande a été traitée,
  jamais qu’un email a été livré.
- Messages FR/KR pour vérification, récupération, invitation, changement
  d’adresse, sécurité, paiements, accès, certificats, contact et escalades.
- RLS, tables privées, suppression après rebond/plainte et permissions admin
  restent appliquées. Aucun contournement direct de la file ou des quotas.

## Vérifications et exploitation

Les tests utilisent désormais aussi le vrai SQL `create_user_with_credentials`
de la migration existante. Ils suivent le parcours HTTP FR et KR jusqu’au vrai
hachage, à la préparation du message, à un fournisseur simulé, à l’utilisation
unique du code et à la connexion autorisée après vérification. Ils couvrent le
quota partagé inscription/renvoi, les erreurs de RPC/table, les reprises et les
contrôles d’accès. Aucun de ces tests n’envoie de message réel.

Validation finale : 17/17 suites, 66/66 assertions de l’audit de sécurité,
TypeScript, lint, scan des secrets, build OpenNext/Cloudflare et bundling
Wrangler `deploy --dry-run` réussis. Les builds utilisent une copie isolée avec
configuration fictive. Le test du scheduler couvre le dispatch authentifié,
le maintien du handler HTTP, le refus sans secret et la remontée d’un échec.

Diagnostic réel après déploiement : les logs du Worker montrent
`stage=token_preparation`, `databaseCode=PGRST202`. La Data API ne résout pas
`prepare_outbox_token(p_id,p_code_hash,p_token_hash,p_expires)` : la fonction
attendue manque ou son cache de schéma est périmé. Cela empêche tout appel à
Resend pour les lignes concernées ; `failed_temporary` ne signifie pas envoyé.

Le propriétaire doit exécuter dans le SQL Editor le fichier complet
`supabase/migrations/20261030182000_repair_email_token_rpc.sql`. Il rétablit
uniquement ce contrat, conserve les droits serveur seuls et notifie PostgREST
de recharger son cache. Il est réexécutable et ne supprime aucune donnée.
Puis patienter quelques secondes et cliquer une seule fois sur « Renvoyer le
code » après le cooldown. Les anciennes lignes encore temporaires sont aussi
reprises à leur échéance ; ne pas effacer la file ni copier les codes de la base.

Aucune opération sur Supabase distant n’a été effectuée par l’agent. La réparation
a été testée sur PostgreSQL local : deux applications, noms exacts des quatre
arguments, droits service_role seulement, parcours FR/KR jusqu’au code utilisable.
Les cinq migrations existantes Auth.js/webhooks/email restent nécessaires ;
les trois migrations email ont déjà été déclarées appliquées par le propriétaire.

Après déploiement, refaire une inscription complète pour une adresse non
vérifiée : un ancien essai pouvait n’avoir créé aucun profil. Si aucun message
n’apparaît dans Resend, consulter les logs Worker `[email] pipeline_failed` :
`registration_create_account`, `outbox_insert`, `outbox_claim`, `material_*` ou
`token_preparation`. `PGRST202` indique un contrat RPC/cache de schéma absent,
`42P01` une table absente, `42501` une permission manquante. Le propriétaire
effectue toute correction distante ; ne jamais coller les clés ou les codes.

La route protégée `/api/cron/email-outbox` est appelée automatiquement chaque
minute par le handler `scheduled` de `custom-worker.mjs`, déclaré dans Wrangler.
Le dispatch interne réutilise OpenNext et transmet `CRON_SECRET` dans l’en-tête
Authorization, jamais dans une URL. Il traite les reprises et les événements
métier par lots de cinq, avec les verrous et limites existants. L’envoi initial
d’inscription reste immédiat. Les déclencheurs Cloudflare peuvent prendre jusqu’à
quinze minutes à se propager ; vérifier ensuite les événements planifiés du Worker.
Si un ordonnanceur externe appelait déjà cette route, le désactiver évite des
appels inutiles ; les verrous de la file protègent malgré tout contre les doublons.

Sources : [API d’envoi Resend](https://resend.com/docs/api-reference/emails/send-email),
[idempotence Resend](https://resend.com/docs/dashboard/emails/idempotency-keys),
[Worker OpenNext personnalisé](https://opennext.js.org/cloudflare/howtos/custom-worker),
[déclencheurs Cloudflare](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

La livraison du nouveau parcours dans le Worker de production reste un contrôle
à effectuer après déploiement ; les tests locaux ne prouvent pas la présence
des fonctions, permissions ou variables sur les services distants.
