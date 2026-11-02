# Retour depuis une leçon — 2 novembre 2026

## Diagnostic
La flèche pointe vers `/[locale]/dashboard/formations`. La destination s’ouvre directement en production. Le nettoyage de `BunnyEmbedPlayer` appelait sans protection `Player.off()` pendant le démontage React. La bibliothèque Player.js publique appelle alors `elem.contentWindow.postMessage(...)` sans vérifier que contentWindow existe. React peut avoir déjà retiré l’iframe avant le nettoyage des effets : une exception de démontage peut donc afficher la frontière d’erreur au changement de page.

## Correction
Chaque abonnement est supprimé indépendamment ; une iframe déjà détachée ne fait plus échouer la navigation. Les références sont invalidées avant le nettoyage et un rappel de fin de lecture tardif est ignoré après démontage. La destination, les permissions et la progression restent inchangées.

## Vérification
- Test unitaire : iframe détachée, suppression des quatre abonnements malgré les exceptions, nettoyage répété et lecteur encore présent.
- Test Chromium avec le vrai composant React et la flèche Retour, à 393 × 852 : l’iframe est retirée avant le nettoyage, le faux SDK reproduit l’accès null de Player.js ; la destination apparaît sans erreur JavaScript.
- La vidéo et le SDK sont simulés dans ce scénario local. Il ne constitue pas une validation du lecteur Bunny sur un iPhone physique.

## Contrôle iPhone
Après déploiement et actualisation de la PWA, ouvrir une leçon, laisser apparaître le lecteur, cliquer sur Retour ; vérifier que Mes formations s’affiche. Répéter après lecture et après une leçon terminée.
