# Présence, messages instantanés et notifications PWA

Livraison sur auth-migration. Aucun accès direct au Supabase distant. Le propriétaire a confirmé la migration 20261103030000_live_message_delivery_and_push.sql. Aucun message ni conversation supprimé, aucune donnée de test en production.

## Présence réelle

Chaque session administrateur ou professeur visible et connectée renouvelle un bail serveur de 45 secondes toutes les 15 secondes. La fermeture, la déconnexion et le passage hors ligne arrêtent ce bail. Plusieurs appareils restent indépendants : une autre session active maintient le statut en ligne. Le heartbeat HTTP ne dépend pas du WebSocket. Les observateurs autorisés vérifient staff_is_online, sur événement et avec un contrôle de secours toutes les 10 secondes ; une vérification indisponible ne devient pas un faux « Hors ligne ». La dernière connexion enregistrée ne détermine jamais ce badge.

## Réception instantanée

Les messages enregistrés déclenchent des événements Broadcast privés contenant seulement les identifiants. Le contenu est relu côté serveur avec authentification et permissions actuelles. Les abonnements Postgres Changes et la réconciliation périodique restent des secours. Une connexion globale met aussi à jour la boîte de réception et les compteurs hors de la page Messages. Les tentatives conservent leur identifiant, les statuts terminé/clôturé restent définitifs, et la lecture de l’historique ne force pas le défilement vers le bas.

Les JWT Realtime sont renouvelés périodiquement et au retour dans l’application. Un jeton absent ou révoqué ne crée pas un abonnement anonyme. Les politiques de lecture vérifient aussi la version de session actuelle.

## Notifications natives

Dans Profil → Notifications des messages, l’étudiant active explicitement la permission du navigateur. Sur iOS, il faut ouvrir Faro School depuis l’icône ajoutée à l’écran d’accueil. Une ancienne installation propose sa mise à jour avant activation. Aucun dialogue de permission ne s’ouvre automatiquement.

Chaque appareil autorisé possède un abonnement privé. Les nouveaux messages staff, IA ou système créent une tâche par appareil. L’envoi immédiat laisse un court délai de 650 ms aux confirmations de lecture. Les messages déjà lus et les comptes/appareils devenus inéligibles sont écartés. Les erreurs temporaires sont reprises par le cron existant ; les abonnements expirés sont désactivés. À la déconnexion, seul l’abonnement de cet appareil et de ce compte est retiré.

Le payload est chiffré selon RFC 8291 et signé par VAPID. Il ne contient aucun extrait de message, nom, e-mail, téléphone ou donnée de paiement. La notification affiche « Faro School — Vous avez reçu un nouveau message », ou sa traduction créole. Safari exige une notification visible pour chaque push effectivement reçu. Un clic ouvre la conversation sur le domaine de Faro School avec les contrôles d’accès ordinaires.

Les secrets VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT sont configurés sur le Worker Cloudflare faro-school. La clé privée est sauvegardée uniquement dans l’environnement local ignoré ; aucune clé privée n’est dans le dépôt. La rotation du couple VAPID exige de réabonner les appareils.

## Vérification

Tests isolés PostgreSQL des autorisations, baux, broadcasts sans contenu, files idempotentes et défaillance du transport ; vecteur de chiffrement officiel RFC 8291 et signature VAPID ; API CSRF, limites et propriété des appareils ; worker Push et navigation sûre ; session Realtime après déconnexion ; navigateur FR/créole pour envoi, reprise réseau, distribution, lecture et arrivée instantanée ; activation volontaire et états iOS/permission refusée/ancienne PWA.

Les essais navigateur et fournisseurs sont simulés localement. Aucun push de test n’a été envoyé à un vrai étudiant. La réception effective dépend du consentement et des réglages de notifications de chaque appareil et reste à confirmer sur celui-ci.
