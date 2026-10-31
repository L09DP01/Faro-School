# PWA iPhone — diagnostic avant modification

## Preuves relevées dans le code existant

- a. src/app/[locale]/layout.tsx contient déjà viewportFit: cover ; l’absence du viewport-fit n’est donc pas la cause constatée. Aucun iPhone physique connecté : les valeurs env() de l’appareil ne sont pas mesurées ici.
- b. StudentDashboardShell impose h-[100dvh] ET max-h-[100dvh], puis plusieurs parents h-full/overflow-hidden. Le body garde min-h-screen (100vh). Les CSS réimposent height:100% aux shells. Il n’existe pas de fallback dvh cohérent pour cet empilement.
- c. globals.css force .pwa-bottom-nav en position:relative, dans une troisième ligne de grille d’un parent masqué, alors que la navigation doit être fixée au viewport. Le fond n’est donc pas ancré au bas physique. Pas de transform/filter/contain identifié sur ces parents ; déplacer la nav hors du conteneur de contenu évitera ce risque.
- d. PwaViewport écrit encore --app-height depuis visualViewport lorsque le clavier est supposé ouvert ; .pwa-viewport dépend de cette valeur. Il déclenche aussi scrollIntoView sur tous les ancêtres. Ce calcul, les événements focusout/resize et le body fixed peuvent produire un cadre temporairement tronqué. La capture réelle est compatible avec ces défauts ; elle ne prouve pas à elle seule lequel produit exactement les ~60pt.
- e. html/body sont bg-bg mais body est position:fixed en standalone, et body::before ajoute un fond navy-deep derrière la barre d’état.
- f. statusBarStyle=black-translucent, themeColor=#031047, manifest theme_color=#031047 et background_color=#FFFFFF : trois surfaces différentes du fond --bg. Le titre Faro School, display standalone et start_url /app?source=pwa sont déjà corrects ; orientation portrait-primary ; les icônes Apple 180 sont déclarées, dimensions à contrôler.
- g. Le main standard a pb-10, pas 64px + safe-area + 16px. Le chat utilise un cadre flex fermé, avec son propre flux ; toute correction doit préserver la saisie et le défilement des messages sans superposer la navigation.
- h. pwa-viewport, shell et parent principal cumulent fixed/height/max-height/overflow:hidden. Le dernier élément est inaccessible si leur hauteur diverge de la zone visible. La capture fournie montre effectivement le bouton de la carte vide sous la navigation.

## Décision de correction

La hauteur du shell sera pilotée par CSS 100dvh avec fallback, sans --app-height JavaScript. La navigation sera fixed bottom:0, hors du flux de défilement, avec fond surface/white jusqu’au home indicator. La zone de contenu réservera sa hauteur et 16px. Le clavier sera seulement un état d’affichage : aucune hauteur mémorisée du shell. Les safe areas seront exposées par --sat/--sab avec env() par défaut, simulables uniquement en développement via debug=safe. Landing exclue.

La valeur exacte du fond sera celle de --bg existant, sans modifier les design tokens. Style Apple choisi : default, adapté au fond clair et à un texte d’état foncé ; le rendu/bloc de flou natif iOS restera un contrôle manuel.

## Limites et méthode de test prévues

Playwright WebKit demandé : profils 393x852, 430x932, 375x667, 320x568. Les données de fixture sont fictives et les transports mockés ; aucune donnée Supabase distante ni email réel. Captures avant/après authentiques de rendu, sans fabrication. Le clavier sera simulé par réduction de la zone visible et focus ; cela ne prouve pas le comportement du clavier iOS matériel. Les métadonnées installées, le Dynamic Island, le home indicator réel et la hauteur au lancement standalone nécessitent l’iPhone.

Les résultats et contrôles manuels seront ajoutés après implémentation.


## Résultat de l’implémentation

- Navigation extraite par PwaBottomNavPortal vers document.body : fixed bottom/left/right 0, hauteur 64px + --sab, fond --surface blanc et z-index 60. Les contrôles WebKit vérifient son parent BODY et l’absence de transform/filter/contain sur tous ses ancêtres.
- Plus de --app-height, de body fixed ou de grille à trois lignes. Le shell et le lecteur sont dimensionnés par 100dvh, avec 100vh uniquement dans @supports not (height:100dvh). Les conteneurs intermédiaires ne fixent plus une hauteur JavaScript ou max-height de viewport.
- Main défile seul pour les pages classiques, avec réserve 64px + --sab + 16px. Pour les chats, le main réserve 64px + --sab, le flux interne reçoit ses 16px, et le compositeur reste au bord supérieur de la nav : la réserve n’est pas doublée.
- Détection du clavier uniquement booléenne : focus et réduction du viewport visible ou du contenu. Une référence transitoire de la fenêtre au repos sert seulement à distinguer les deux modèles de navigateur ; elle est réévaluée au blur/changement de largeur et n’est jamais appliquée au shell ou enregistrée dans les styles. Aucune hauteur de mise en page n’est écrite. La fermeture, pageshow et visibilitychange réévaluent l’état. Aucun scrollIntoView des ancêtres. Le comportement du clavier matériel nécessite néanmoins le contrôle iPhone ci-dessous.
- Entrées/textarea/select à 16px minimum et sans transition de font-size (un contrôle WebKit a détecté 15,99px pendant l’ancienne transition). Boutons touch-action:manipulation ; text-size-adjust 100% ; zoom manuel conservé.
- Les safe areas --sat/--sab utilisent env() par défaut. Debug=safe et ses paramètres sat/sab n’activent les contours et les valeurs simulées qu’en développement ; le garde de production est testé.
- Accueil : prénom capitalisé uniquement pour l’affichage (le nom stocké et les certificats restent intacts), sous-titre provenant d’une seule clé traduite. FR et KR sont vérifiés séparément.

### Valeurs exactes choisies

| Élément | Valeur |
| --- | --- |
| viewport | width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover, interactive-widget=resizes-content |
| color-scheme | light |
| apple-mobile-web-app-capable | yes |
| apple-mobile-web-app-status-bar-style | default |
| apple-mobile-web-app-title | Faro School |
| theme-color | #F8FAFC, identique au token existant --bg |
| html/body/app background | var(--bg), #F8FAFC |
| fond de navigation | var(--surface), #FFFFFF, étendu sous l’indicateur |
| manifest name / short_name | Faro School / Faro School |
| manifest theme_color / background_color | #F8FAFC / #F8FAFC |
| manifest display / orientation | standalone / portrait |
| manifest start_url / id / scope | /app?source=pwa / /app / / |
| Apple touch icons | /apple-touch-icon.png et /icons/apple-touch-icon-180.png ; dimensions PNG réellement lues : 180x180 |

`default` est choisi pour le fond clair ; aucune surcouche navy ou gradient CSS n’est placée derrière le statut. Le style, les icônes de statut et un éventuel flou natif restent contrôlés par iOS. interactive-widget=resizes-content demande un redimensionnement natif aux navigateurs qui le prennent en charge : ce n’est pas une preuve du comportement de toutes les versions d’iOS.

Références : [Apple, configuration des applications web](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) ; [MDN, viewport](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport).

### Tests et captures effectivement réalisés

Playwright WebKit, profils iPhone 15 Pro, Pro Max et SE, viewports explicitement imposés à 393x852, 430x932, 375x667 et 320x568. Notch simulé : --sat=59px / --sab=34px ; SE et étroit : 0/0. 36 combinaisons de rendu : accueil, formations, communauté vide, communauté avec messages, boîte Messages, discussion, profil, paramètres, lecteur. Seules des données fictives et des transports locaux mockés sont utilisés ; ce test ne vérifie pas les paiements ou Realtime en production.

Assertions : nav bottom égal à la hauteur du viewport, hauteur 64+safe, un fond jusqu’au bord, aucun ancêtre qui détourne le fixed, pas de débordement horizontal, dernière limite de contenu au-dessus de la nav après défilement, compositeurs sans chevauchement, champs à 16px minimum, header respectant le safe top, navigation absente du lecteur. Les tests de langue vérifient Bonjour/Bonjou, Lorvenson et l’absence de mélange de sous-titre.

Le clavier est simulé par focus, signal visualViewport et réduction de la zone visible à 393x500. Navigation masquée puis restaurée à bottom=852 à la fermeture : assertions passées. La capture correspondante mesure cette zone visible réduite : elle ne contient pas le clavier UIKit, impossible à afficher dans WebKit desktop. Le PNG n’est pas présenté comme une photo d’un clavier iPhone.

Avant : capture du vrai rendu du code antérieur dans la fixture, avec safe areas simulées et contours ajoutés au harnais, avant modification du code produit. Elle ne reproduit pas la bande de 60pt du téléphone réel. Après : vrais rendus des composants corrigés, sans image générée ni maquette dessinée. Les dimensions ci-dessus sont en pixels CSS ; les PNG utilisent le DPR des profils (3 sur Pro, 2 sur SE).

Fichiers dans docs/screenshots/pwa-iphone/ : before-home-393-debug.png, after-home-393-debug.png, after-home-393.png, after-formations-393.png, after-community-empty-393.png, after-community-messages-393.png, after-community-keyboard-simulated-393x500.png, after-community-keyboard-closed-393.png, after-messages-393.png, after-message-thread-393.png, after-profile-393.png, after-settings-393.png, after-home-375.png, after-home-320.png, after-home-bottom-393.png et after-home-kr-393.png. results.json consigne les cas et les limites.

Reproduction : lancer node scripts/dashboard-mobile-visual-server.mjs, puis python scripts/test-pwa-iphone.py avec Playwright et son moteur WebKit installés. Le serveur rend les vrais composants avec fixtures, jamais un compte réel. Le debug et les simulations ne sont pas des fonctionnalités de production.

## Contrôles manuels obligatoires sur l’iPhone — pas encore confirmés

1. Attendre le déploiement. Supprimer l’app installée de l’écran d’accueil (pas le compte Faro School), puis ouvrir https://faroschool.com/app?source=pwa dans Safari et ajouter à nouveau Faro School à l’écran d’accueil. Activer l’ouverture comme application web si cette option est proposée par la version d’iOS.
2. Fermer Safari et lancer l’icône. Confirmer le nom, la vraie hauteur au lancement, le fond autour de Dynamic Island et la lisibilité de l’heure. Le flou natif éventuel doit être cohérent avec le fond clair ; son absence ne peut pas être garantie par CSS.
3. Vérifier le fond blanc de navigation jusqu’au home indicator réel, sans bande différente. Parcourir accueil, formations, communauté, messages, profil et paramètres ; défiler jusqu’au dernier bouton. Vérifier aussi certificats et paiements qui réutilisent le shell.
4. Ouvrir le clavier dans la communauté et une discussion, taper, ouvrir le clavier emoji puis fermer le clavier. La saisie doit rester visible, la navigation se masquer puis revenir au bord inférieur ; aucun saut de zoom ou déplacement de l’en-tête. Refaire après mise en arrière-plan, verrouillage/déverrouillage et réouverture.
5. Ouvrir le lecteur : navigation absente, contenu sous le statut lisible, retour au dashboard restaurant le cadre.
6. Comparer Safari non installé, FR et KR. L’entrée /app, la connexion et l’exclusion de la landing en mode installé restent inchangées. Debug=safe ne doit produire aucun contour en production.

Ces vérifications matérielles restent ouvertes : WebKit automatisé ne prouve ni la barre d’état native, ni le vrai home indicator, ni la hauteur de lancement standalone, ni le clavier iOS. Aucun résultat réel iPhone n’est inventé.


## Validation de livraison

30/30 suites TypeScript/sécurité passent, ainsi que les 36 cas WebKit et le scénario de clavier simulé. Typecheck, lint et build OpenNext de production passent. Les sources src/ ont été comparées octet par octet au dossier du build validé : aucune divergence. Aucun jeton de design n’a été modifié, aucune migration ou opération Supabase distante n’a été effectuée.

Les modifications fonctionnelles concernent uniquement les défauts Profil/Paramètres demandés dans le premier paragraphe du besoin ; la partie PWA ne modifie que structure, dimensions, métadonnées et textes d’accueil explicitement demandés. La communauté, les paiements, les progrès, l’authentification, /app, les règles PWA et le service worker conservent leurs mécanismes existants.

Les vérifications matérielles listées plus haut restent à réaliser par l’utilisateur : cette livraison ne les coche pas comme réussies.


### Complément issu de la relecture des PNG à 320px

La carte Heures d’apprentissage poussait son icône hors de sa bordure et Communauté était elliptique. En dessous de 360px seulement, les icônes occupent leur propre ligne, les libellés restent dans la largeur utile et les captions de navigation utilisent 10px sans padding latéral. Les champs de saisie restent à 16px minimum. Les tests vérifient désormais les limites et l’absence de chevauchement de chaque tuile, ainsi que l’absence de troncature de chaque libellé de navigation sur les quatre tailles. La capture after-home-320.png a été régénérée à partir du vrai rendu corrigé.


### Contrôle du HTML réellement servi

Le contrôle anonyme du HTML après déploiement a montré que Next.js 15 émettait mobile-web-app-capable=yes mais omettait l’alias apple-mobile-web-app-capable malgré appleWebApp.capable=true. L’alias Apple est donc ajouté explicitement via metadata.other ; les deux noms ont la même valeur yes. Le style reste unique : default. Ce contrôle complète les assertions de configuration, sans connexion à un compte ni interrogation Supabase.
