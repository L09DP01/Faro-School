# Correctifs PWA et saisie mobile

- Champs non marketing : police d’au moins 16 px sur mobile/tactile, sans transition de taille, pour éviter le zoom automatique iOS. Le zoom manuel reste accessible.
- Le véritable mode standalone (display-mode / navigator.standalone) pilote le shell ; le cookie de préférence de navigation ne verrouille pas le navigateur web.
- Dans la PWA, le document reste fixe ; le contenu défile à l’intérieur et les en-têtes restent hors du panneau de défilement. La hauteur suit le visualViewport lors de l’ouverture du clavier.
- Safe areas supérieure et latérales couvertes ; barre d’état opaque marine, icônes iOS claires ; espace inférieur conservé pour l’indicateur d’accueil. Navigation élève et shell admin adaptés.
- Landing explicitement exclue des règles de champs et du verrouillage du défilement. Aucun fichier de sa page n’a changé.

Validation : typecheck/lint ; sept contrôles Chromium mobile sur les vrais composants dans une fixture isolée, sans backend ni emails. Captures : docs/screenshots/pwa-mobile/. La hauteur du clavier est simulée. Safari iOS installé, le clavier système et les safe areas physiques ne sont pas reproductibles avec cette émulation : vérifier sur l’iPhone après déploiement et actualisation de la PWA.

Vérification iPhone : ouvrir connexion/inscription dans Safari puis dans la PWA ; toucher chaque champ ; faire défiler un long formulaire avec clavier ouvert et fermé ; vérifier l’en-tête, la barre d’état et la navigation inférieure ; vérifier communauté/messages et un retour au profil. Le service worker doit charger la nouvelle version ; utiliser la proposition de mise à jour ou fermer/réouvrir l’application après déploiement.
