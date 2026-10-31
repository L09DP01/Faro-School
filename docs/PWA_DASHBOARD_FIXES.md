> Mise à jour : les choix de hauteur/position décrits dans ce document historique sont remplacés par PWA_IPHONE_NOTES.md (CSS dvh, navigation fixed dans un portal body, aucune hauteur JavaScript).

# Correctifs prioritaires — PWA et dashboard, 30 octobre 2026

## A — Emails répétés (déployé en premier : f46e4a1)

Le cron reprenait des demandes de vérification conservées pendant la panne,
y compris après confirmation du compte. Avant de préparer une preuve ou
d’appeler Resend, le worker vérifie désormais que le compte n’est pas déjà
confirmé et que la demande date de moins de dix minutes. Une demande obsolète
devient `suppressed`, état terminal : elle n’est plus réclamée par le cron.
Il s’agit de l’annulation de cette demande, pas d’une suppression globale de
l’adresse : les emails de paiement, sécurité ou récupération restent actifs.

Les tests PostgreSQL locaux vérifient qu’un compte confirmé et une demande
ancienne ne provoquent aucun appel fournisseur, et que la file devient terminale.
Une remise déjà acceptée par Resend avant déploiement ne peut pas être rappelée.
Le déploiement Cloudflare de ce commit a été observé réussi avant la suite.

## B — Communauté réservée aux membres inscrits

Une connexion seule ne suffit plus : un élève doit avoir une inscription
`enrollments.revoked_at IS NULL`. Les accès accordés manuellement restent valides.
Les formateurs et administrateurs vérifiés conservent leur accès. Les comptes
bannis sont refusés. Le helper existant `can()` est réutilisé.

Le contrôle protège la page, les lectures, les actions d’envoi, les réactions,
les signalements et les marqueurs de lecture. Sans droit, la page affiche un
état verrouillé FR/KR avec lien vers les formations, sans monter le chat.

La migration `20261030200000_community_entitlement.sql` ajoute des politiques
RLS restrictives aux cinq tables communautaires et protège la présence privée.
Elles se combinent aux règles existantes de propriété, mute et modération.
Le canal devient `community-enrolled-room`, privé ; il ne partage pas la présence
avec l’ancien canal public. Les événements Postgres restent filtrés par RLS.
Le propriétaire a confirmé avoir appliqué cette migration. L’agent n’a effectué
aucune opération sur le Supabase distant.

Les tests réels PostgreSQL couvrent l’élève sans inscription, l’inscription active,
la révocation, les comptes non vérifiés/bannis et les rôles staff, y compris une
politique permissive préexistante qui ne doit pas contourner le verrou restrictif.
Les actions directes sont testées avant toute écriture.

## C — Indicateurs réels

Les valeurs codées en dur 12 et 1 ainsi que le point permanent de la cloche
sont retirés. `/api/dashboard/unread` lit uniquement les compteurs du compte
authentifié, répond avec `Cache-Control: no-store` et ne retourne aucun message
ou profil. Les compteurs démarrent à zéro et se rafraîchissent à la navigation,
au retour dans l’application et toutes les trente secondes quand elle est visible.
La communauté n’est jamais comptée pour un élève sans accès. Ses propres messages
ne sont pas comptés comme non lus. Les erreurs de lecture n’inventent pas de badge.
La présence n’affiche plus un minimum artificiel de 142 personnes.

## D — PWA principale

Le cadre commun dashboard/admin/certificats utilise la hauteur du viewport visuel,
un en-tête opaque fixe dans le cadre et une navigation basse avec sa safe area.
Seul le contenu défile ; les pages longues ne rétrécissent plus artificiellement.
Les conversations et le lecteur ont des zones internes adaptées à ce cadre.
La détection du clavier est initialisée au montage. Les contrôles gardent au
moins 16 px, sans interdire le zoom manuel. Le point d’entrée `/app` utilise
le validateur commun des redirections relatives. La landing reste exclue.

Le service worker change de version pour que les installations existantes
détectent la mise à jour. Il attend le bouton « Actualiser » au lieu de recharger
une conversation en cours dès l’installation du nouveau worker. Seuls les anciens
caches Faro sont nettoyés. Le parcours d’actualisation est testé hors réseau.

Vérification dans le navigateur avec les vrais composants, données fictives et
réseau simulé : à 390 × 844, en-tête y=0, contenu de y=56 à y=780, navigation de
y=780 à y=844, aucune bande sous la navigation ni débordement horizontal.
Après défilement interne de 1228 px : document y=0, en-tête y=0, navigation
toujours en bas. Le champ du profil est à 16 px. Le chat réel et l’état verrouillé
FR/KR ont été inspectés. Le cadre reste correct à hauteur 420 et sur desktop 1440.

Ces vérifications ne simulent pas complètement le clavier système, le notch,
le rebond Safari ni l’installation iOS. Après déploiement, fermer puis rouvrir la
PWA sur l’iPhone et confirmer ces gestes sur l’appareil réel. Aucun envoi email
de test ni achat n’est effectué par ces fixtures.

Sources : [autorisation Realtime](https://supabase.com/docs/guides/realtime/authorization).

Validation finale : 21/21 suites, TypeScript, lint, scan des secrets, build
OpenNext/Cloudflare et dry-run Wrangler réussis. Les 322 fichiers source compilés
correspondent aux sources publiées. Le service worker public est en plus validé
par son test de cycle de vie et le bundling final des assets. Aucune donnée de
production n’a été interrogée ou modifiée dans Supabase par l’agent.
