# Audit et correction de la messagerie — 2 novembre 2026

## Constats
- Présence issue de profiles.last_seen_at : un dernier passage ne prouvait pas une connexion active, les onglets partageaient un seul indicateur.
- Support bloqué pendant waiting_staff ; une réponse de l’administrateur résolvait trop tôt l’escalade. Clôturer supprimait la conversation de la vue élève (filtre et RLS), sans suppression SQL de son contenu.
- Le rafraîchissement remplaçait l’historique affiché ; une panne de lecture pouvait être interprétée comme une liste vide. La réconciliation optimiste utilisait parfois le contenu du texte plutôt que l’identifiant.
- Les messages confirmés affichaient tous deux checks verts, sans distinguer réception et lecture. La boîte administrateur dépendait du polling à cinq secondes.
- Une aide IA incertaine produisait une demande générique répétitive. L’envoi attendait aussi les traitements IA.

## Changements
Présence privée Realtime staff-live:<uuid>, une clé par session de navigateur, heartbeat toutes les 20 secondes et bail serveur de 45 secondes lié au token_version vérifié. Départ, perte réseau et déconnexion retirent la présence de cette session ; les autres restent actives. La présence du compte est indépendante du bouton de disponibilité. Les événements Realtime affichent la déconnexion ; le bail protège le backend en cas de coupure brutale. Des retards de détection réseau jusqu’à l’expiration du bail restent possibles. Les jetons Realtime sont renouvelés.

Les escalations existantes restent la source de vérité des tickets. Assistance mode AI_ACTIVE, HUMAN_SUPPORT et AI_RESUMED est persisté et mis à jour sous verrou. L’élève continue à écrire pendant un ticket ; l’IA ne répond pas. Un compteur assistance_epoch invalide même une ancienne réponse qui reviendrait après la résolution du ticket. Prendre le relais ou répondre ne résout plus un ticket support. Résoudre clôture le ticket et rend l’IA disponible dans la même conversation. Les anciennes discussions réellement clôturées restent consultables, sans être rouvertes automatiquement. Les cours conservent leur contrôle auteur et leur mécanisme distinct de reprise.

Enregistrement puis traitement IA via after()/waitUntil OpenNext : l’accusé serveur n’attend plus le fournisseur. Conseils publics FR/KR vérifiés pour achat, tableau de bord, vidéo et mot de passe ; jamais de statut inventé de compte ou de paiement. Le modèle reste utilisé pour les autres questions autorisées, avec protections existantes et coupe-circuit global. Une demande explicite d’administrateur peut ouvrir le ticket numéroté existant.

Client_message_id unique conservé au réessai ; rapprochement par identifiant ; conservation des lignes déjà reçues et des optimistes lors des rafraîchissements ; erreur de lecture explicite. Indicateurs accessibles : horloge, enregistrement, distribution à une session, lecture lorsque la vue est visible, focalisée et au bas des messages. Les accusés ne sont modifiables que via une fonction vérifiant les participants. Realtime INSERT/UPDATE et conversations déclenchent la synchronisation des deux interfaces ; polling de secours conservé. Pas de défilement forcé si l’utilisateur lit plus haut.

## Migration et données
supabase/migrations/20261102230000_live_messaging_sessions.sql est additive : sessions de présence privées avec RLS, champs d’assistance, delivered_at, fonctions de contrôle/accusés et politiques de lecture de l’historique. Aucun DELETE ni TRUNCATE de conversation ou de message. Les anciens messages restent sous leur type compatible staff avec rôle admin/instructor ; les historiques ne sont pas réécrits. Les droits d’accès par conversation et sanctions restent appliqués. Migration confirmée appliquée par le propriétaire ; aucun accès Supabase distant effectué par l’agent.

## Vérifications
- PostgreSQL local : deux sessions, expiration/déconnexion d’une session, révocation de version, autorisation des accusés, distribution puis lecture, ticket actif, écriture continue, réponse IA tardive, résolution/reprise, ancien historique visible, modification directe navigateur refusée.
- HTTP réel isolé : identité propre, version de session, sortie d’une session, refus étudiant et origine étrangère.
- Actions : accusé avant traitement différé, ouverture d’un ticket avant génération, plusieurs échanges pédagogiques et absence de fournisseur appelé pendant support humain.
- Navigateur Chromium, vrais composants FR/KR : états de présence synchronisés, multi-session, horloge, échec réseau, même identifiant au réessai, aucun doublon, indicateurs distribution et lecture.
- Les fournisseurs, le réseau Realtime et les données sont simulés dans ces tests locaux. Aucun compte, message ou ticket de test créé sur les services de production. Les bases locales éphémères sont fermées après les tests.

## Contrôles sur appareils réels après déploiement
Ouvrir deux sessions administrateur et une session élève. Vérifier arrivée/départ, fermeture d’un seul onglet puis des deux, coupure réseau. Poser une question d’achat en FR/KR. Ouvrir un ticket pendant une réponse IA : aucune nouvelle réponse IA, écriture élève toujours possible. Répondre côté support, vérifier distribution/lecture, puis résoudre : historique présent et IA disponible sur le message suivant. Vérifier également la PWA installée et la reconnexion après une interruption longue.
