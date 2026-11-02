# Publication bloquée — 2 novembre 2026

## Cause constatée

Le formulaire de production restait sur « Enregistrement en cours… ». Sa couverture
était une URL `data:image/png;base64` de **1 495 010 caractères**. L’ancienne API
`/api/admin/upload/cover` retournait systématiquement les octets encodés, sans
réel stockage Bunny. Leur inclusion dans le Server Action dépasse la limite
Next.js par défaut de 1 Mo. Le gestionnaire du formulaire ne possédait aucun
`catch/finally` autour de cet appel : une exception de transport laissait `saving`
à true. La limite globale n’a pas été augmentée.

Référence : https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions#bodysizelimit

## Correction

- Upload multipart (JPG/PNG/WebP, maximum 3 Mo) vers Bunny Storage, préfixe public
  réservé `courses/covers/`, nom UUID aléatoire, type et signature de fichier vérifiés.
- Aucune image base64 ni clé retournée. Seule une URL courte `/api/covers/<uuid>.<ext>`
  est incluse dans la sauvegarde. La route de lecture récupère l’image depuis Storage
  avec la clé côté serveur, sans dépendre d’un CDN public configuré. Elle ne permet
  aucun chemin arbitraire ni lecture des PDF, signatures ou ressources privées.
- Les uploads restent réservés aux administrateurs/professeurs authentifiés et
  vérifiés via le contrôle existant ; rejet des origines différentes, timeout fournisseur.
- Les anciennes images inline sont envoyées séparément avant le Server Action.
  Celui-ci refuse aussi les couvertures inline ou les URL anormalement longues.
- Un `finally` libère les boutons en cas d’exception. Les champs restent en place
  après échec. Aucune nouvelle tentative de publication automatique n’est effectuée.
- Le formulaire ne démarre pas une sauvegarde pendant un upload de couverture/vidéo.

## Vérification et limites

- Tests HTTP locaux : octets multipart réels de 1,1 Mo, PUT Bunny simulé, URL courte,
  rôles, erreur de configuration/fournisseur, type invalide, chemins privés refusés.
- Test navigateur du vrai formulaire : image inline supérieure à 1 Mo, exception
  simulée du Server Action, boutons réactivés, titre conservé, puis succès au nouvel
  essai sans deuxième upload. Aucun cours de production créé par le test.
- Captures locales : `docs/screenshots/course-save/`.
- Diagnostic régional confirmé ensuite dans le tableau de bord Bunny : zone
  `faro-storage` (2022731), **New York**, endpoint
  `https://ny.storage.bunnycdn.com/faro-storage`. L’ancien endpoint européen renvoyait
  401 ; avec exactement la même clé, New York répond 200 en lecture et 201 lors d’un
  vrai upload d’image technique de 134 octets. Le propriétaire a confirmé les valeurs
  Production du nom de zone et de la clé Storage.
- La connexion Storage est centralisée pour couvertures et uploads de signature.
  `BUNNY_STORAGE_REGION` vaut `ny` par défaut pour cette zone existante ; `de` permet
  une zone européenne dans un autre environnement. Seuls les codes régionaux pris
  en charge sont acceptés : aucune clé ne part vers un hostname arbitraire.
- Aucune opération Supabase distante. Aucune migration nécessaire.
- Le formulaire déjà ouvert utilise l’ancien JavaScript : l’utilisateur conserve
  lui-même sa saisie avant de recharger. Il a refusé une copie locale de ses champs.
