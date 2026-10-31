# Messagerie : panneaux fixes et défilement interne

## Diagnostic
Les captures montrent que la page entière défilait : l’en-tête de la discussion et la saisie étaient entraînés hors écran. Le composant avait une carte avec `min-h-[640px]` sans hauteur maximale héritée du viewport. Les enfants flex n’avaient pas systématiquement `min-height: 0`. L’enveloppe admin et sa page possédaient alors le défilement, au lieu des seuls panneaux internes. La classe `no-scrollbar` était utilisée mais aucune règle CSS correspondante n’était définie. Le menu permanent dès 768 px n’avait pas de commande de repli.

## Corrections
- Le shell admin reste borné au viewport CSS existant (`100dvh`, fallback déjà présent). Le contenu de messagerie remplit l’espace restant avec une chaîne flex/min-height:0 ; pas de hauteur calculée en JavaScript.
- L’en-tête de l’administration, les onglets et le titre restent hors du défilement. Dans la carte : en-tête de conversation, réponses rapides et saisie ne rétrécissent pas ; seuls le flux des messages et la liste des conversations défilent.
- Barres visuelles masquées via `scrollbar-width:none` et `::-webkit-scrollbar`; tactile, molette et clavier restent disponibles. Les deux panneaux défilants sont accessibles au clavier.
- Bouton de repli/réouverture du menu latéral à partir de 768 px, avec libellés FR/KR, aria-controls et aria-expanded. Sur mobile, le tiroir existant reste disponible ; logo, disponibilité et commande du menu tiennent aussi à 320 px.
- Sous 1024 px, la liste et la discussion se présentent successivement, avec retour à la liste. Sous 640 px, lorsqu’une discussion est ouverte, le titre et les onglets sont masqués pour réserver la place aux messages ; ils reviennent avec la liste. Sur une faible hauteur, les réponses rapides sont repliées pour préserver la saisie.
- Insets haut/bas respectés dans le shell standalone ; textarea à 16 px, bouton Répondre au moins 44×44 px, y compris à l’état désactivé.
- Aucune modification de données, permission, modèle IA, paiement ou règle métier ; aucune migration requise.

## Vérification
`tests/staff-inbox-visual.tsx` monte les véritables composants avec des conversations fictives locales. `scripts/staff-inbox-visual-server.mjs` ne fournit qu’un serveur de test sur 127.0.0.1 ; aucune route de démonstration n’est ajoutée à l’application. `tests/staff_inbox_layout.py` utilise Playwright.

Scénarios Chromium et WebKit : 1440×900, 1024×768, 768×1024, 820×1180, 390×844 et 320×568. Vérifications :
- positions de l’en-tête et de la saisie inchangées pendant le scroll ;
- dernier message visible au-dessus de la saisie ;
- aucun débordement horizontal ni défilement du document ;
- liste indépendante, barres masquées, commande du menu latéral fonctionnelle ;
- viewport réduit puis restauré, police de saisie ≥16 px ;
- passage portrait/paysage et commandes KR.

Images et résultats : `docs/screenshots/staff-inbox/`, dont `webkit-1440x900.png`, `webkit-1024x768-collapsed.png`, `webkit-768x1024-collapsed.png`, `webkit-390x844.png`, `webkit-320x568.png` et `webkit-ipad-landscape-kr.png`.

Ces essais sont des rendus de composants réels avec données de test ; ils ne représentent pas une session utilisateur en production. Le viewport réduit simule une contrainte de hauteur, pas le véritable clavier iPad. À vérifier sur l’appareil : ouverture/fermeture du clavier natif, orientation, gestes de défilement et safe areas réelles dans la PWA installée.

Résultats de validation : 12 dispositions FR mesurées dans Chromium/WebKit, plus 2 contrôles KR avec rotation portrait/paysage ; captures sauvegardées. Les 37 suites de régression passent ; TypeScript, lint et contrôle de secrets sont propres. Build OpenNext de production réussi ; aucune différence entre les sources applicatives compilées et publiées, hors normalisation des fins de ligne CSS.
