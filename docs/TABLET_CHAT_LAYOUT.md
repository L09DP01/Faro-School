# Communauté et Messages sur tablette — 2 novembre 2026

Cause : dès 768 px, les vues ouvraient deux panneaux, dont une liste de 380/410 px. La barre latérale de 285 px et les marges ne laissaient presque plus de largeur au chat.

Correction : en dessous de 1280 px, la liste occupe l’espace disponible, puis la discussion la remplace après sélection. Le bouton Retour réaffiche la liste. La communauté s’ouvre sur sa liste. À partir de 1280 px, les deux panneaux et la largeur de liste de 410 px sont conservés. La barre latérale du dashboard est inchangée. Les panneaux conversation ont min-width:0 pour ne pas pousser le contenu hors écran. Les nouveaux messages communautaires ne sont marqués lus que si le chat est visible.

Tests Chromium locaux FR/KR : 390, 768, 820, 894, 1024, 1180, 1280 et 1440 px ; sélection, retour, absence de débordement, géométrie inchangée de la barre latérale et accusé de lecture lié à la visibilité. Composants réels, données isolées uniquement dans le navigateur de test ; aucune donnée créée en production. Aucun changement SQL ni de design tokens.

Le contrôle natif d’une PWA installée sur iPad reste à effectuer sur appareil réel après actualisation.
