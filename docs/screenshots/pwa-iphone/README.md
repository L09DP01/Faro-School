# Captures PWA iPhone

Vrais PNG Playwright WebKit sur données de démonstration. Consulter [PWA_IPHONE_NOTES.md](../../../PWA_IPHONE_NOTES.md) pour les limites ; aucun iPhone physique n’a été testé.

- before-home-393-debug.png / after-home-393-debug.png : avant/après, 393x852 CSS, safe top 59 / bottom 34 simulés. Le harnais avant ajoute uniquement les contours et simule env().
- after-home-393.png, after-formations-393.png, after-community-empty-393.png, after-community-messages-393.png, after-messages-393.png, after-profile-393.png : écrans après, même viewport.
- after-community-keyboard-simulated-393x500.png : focus et viewport visible réduit, clavier OS non rendu ; after-community-keyboard-closed-393.png : retour au viewport 393x852.
- after-home-375.png / after-home-320.png : 375x667 et 320x568 CSS, safe areas nulles.
- after-home-bottom-393.png : dernier contenu entièrement accessible au-dessus de la nav.
- after-settings-393.png, after-message-thread-393.png, after-home-kr-393.png : contrôles complémentaires.

Les PNG Pro sont à DPR 3, les SE à DPR 2. results.json contient les 36 cas sur les quatre tailles, dont le lecteur sans navigation. Les contrôles matériels à effectuer sont listés dans PWA_IPHONE_NOTES.md à la racine du dépôt.
