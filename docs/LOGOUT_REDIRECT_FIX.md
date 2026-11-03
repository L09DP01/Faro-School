# Déconnexion vers la page de connexion

Les boutons de l’en-tête utilisaient signOut côté client puis router.push/refresh ; les boutons du profil utilisaient un autre chemin. Tous utilisent désormais LogoutButton et une Server Action commune.

La Server Action attend Auth.js, expire les cookies de session authjs/next-auth sécurisés, anciens et fragmentés ainsi que les anciens callback-url présents, puis retourne une destination locale FR/HT. Le bouton utilise location.replace après confirmation serveur. La suppression des cookies dans une Server Action invalide également le cache du routeur Next.js. Les préférences PWA sont conservées. Les contrôles d’accès privés restent actifs ; aucun paramètre ne permet de contourner l’authentification de la page de connexion.

Validation : test local de l’action (ordre, cookies, fragments, destinations, échec), test existant des contrôles PWA (succès et échec), TypeScript et lint. Aucun compte ni donnée de production utilisé. L’article initial Compte a été revérifié : sa procédure reste exacte ; seule son empreinte de source a été actualisée. Aucune migration SQL supplémentaire.
