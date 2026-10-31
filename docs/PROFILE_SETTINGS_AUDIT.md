# Audit Profil et Paramètres — Faro School

Périmètre : code de navigation élève, page Profil, formulaires, API profil/changement d’e-mail et transaction SQL de sécurité. Audit du code local ; aucune inspection ni modification de Supabase distant. Les contrôles physiques iPhone restent à effectuer.

## Incohérence corrigée

Les deux liens latéraux pointaient vers /dashboard/profil avec la même règle de sélection. Ils étaient donc tous deux orange. Le raccourci Paramètres pointait également vers une ancre de cette page, qui regroupait tout.

- Profil : /[locale]/dashboard/profil, sélection exacte, identité et raccourcis de compte.
- Paramètres : /[locale]/dashboard/profil/parametres, sélection propre, préférences et sécurité.
- Les formulaires et API existants sont réutilisés. Aucune table ou fonctionnalité métier dupliquée.
- En PWA, cinq onglets sont conservés. Profil reste le groupe actif en bas lorsque Paramètres est ouvert ; sur le menu latéral, seul Paramètres est actif. C’est intentionnel : deux menus de niveaux différents, pas deux entrées sélectionnées dans un même menu.
- Les nouveaux titres et libellés existent en FR et KR. Les couleurs et composants existants sont conservés.

## Contenu et comportement attendu

| Écran | Contenu | Fonctionnement |
| --- | --- | --- |
| Profil | Nom complet et téléphone | Données personnelles modifiables ; validation serveur ; enregistrement explicite et confirmation. Elles ne donnent aucun droit supplémentaire. |
| Profil | Adresse e-mail actuelle | Consultation ; le remplacement se fait dans Paramètres après vérification. Ne jamais remplacer directement l’adresse depuis le formulaire personnel. |
| Profil | Rôle et état du compte | Information en lecture seule recommandée ; le rôle n’est jamais modifiable par l’élève. L’accès exige déjà un compte vérifié côté serveur. Le rôle n’est pas encore affiché comme champ dans cette page. |
| Profil | Certificats et paiements | Raccourcis vers les pages existantes ; documents de son propre compte uniquement. Changer le nom du profil ne réécrit pas un certificat déjà émis : son nom est un instantané, correction via réémission administrateur. |
| Profil | Aide, installation, déconnexion | Aide réelle configurée ; installation mobile seulement si disponible ; déconnexion Auth.js effective. |
| Paramètres | Langue FR/KR | Préférence enregistrée en base ; cible : appliquer immédiatement la langue à la route et synchroniser le cookie de langue. |
| Paramètres | Changement d’adresse e-mail | Mot de passe actuel, code envoyé à la nouvelle adresse, remplacement seulement après vérification ; ancienne adresse conservée jusqu’au succès. Le serveur contrôle l’identité et les limites d’envoi. |
| Paramètres | Changement de mot de passe | Mot de passe actuel obligatoire, nouveau mot de passe robuste et confirmation ; token_version incrémenté pour rejeter les anciennes sessions ; ensuite proposer explicitement la reconnexion. |
| Paramètres, évolution | Notifications | Uniquement des préférences persistées et réellement utilisées : notifications de cours/communauté, messages, communications facultatives. Ne pas proposer d’interrupteur factice ni désactiver les codes de vérification ou alertes de sécurité indispensables. Pas de préférences utilisateur d’envoi implémentées dans cet écran. |
| Paramètres, évolution | Sessions/appareils et fermeture du compte | Ne pas afficher une liste inventée : le JWT actuel ne fournit pas de registre des appareils. Prévoir révocation serveur, confirmation forte et un parcours de demande de fermeture avec règles de conservation explicites avant de présenter ces fonctions comme disponibles. |

## État réel et écarts restants

1. **P1 — validation du nom à renforcer.** L’API applique min(2) avant trim(), sans maximum. Des espaces peuvent passer la validation puis devenir un nom vide ; imposer trim puis longueur bornée sur le serveur. Ce point n’est pas modifié par la correction de navigation.
2. **P2 — téléphone vide non effaçable.** Une valeur vide produit null mais n’est pas ajoutée à updateData : le numéro existant reste en base. Distinguer champ absent et suppression demandée.
3. **P2 — langue enregistrée sans application immédiate.** Le formulaire fait router.refresh(), sans changer la route ni les cookies ; ne pas promettre que l’interface bascule instantanément.
4. **P2 — reconnexion après changement du mot de passe.** La révocation serveur existe, mais le formulaire affiche seulement un succès. Ajouter une action de reconnexion claire pour éviter une sortie de session perçue comme une erreur au clic suivant.
5. **P2 — erreurs API et traduction.** L’API profil renvoie des messages français et certains détails techniques bruts. Préférer des codes d’erreur publics stables, traduits FR/KR, avec diagnostic serveur expurgé.
6. **P2 — rafraîchissement après changement d’e-mail.** Le formulaire confirme le succès sans actualiser explicitement l’ensemble de l’identité affichée. Prévoir refresh/retour au profil après la nouvelle session.
7. **P2 — support de démonstration.** Le numéro WhatsApp a une valeur de secours +509 36 00 00 00. Configurer un vrai contact ; retirer la promesse 7j/7 tant que le service n’est pas garanti. Le texte préremplit aussi l’adresse e-mail de l’utilisateur dans WhatsApp : préférer un message minimal sans donnée personnelle imposée.
8. **Fonctions absentes :** avatar personnalisé, préférences de notification, registre des sessions/appareils et parcours autonome de fermeture du compte. Ce sont des évolutions proposées, pas des éléments construits par ce correctif.

## Contrôles déjà présents à conserver

API réservée au compte connecté vérifié ; mises à jour limitées à son propre UUID ; rôle non accepté dans le schéma public ; mot de passe actuel vérifié ; mots de passe stockés hachés côté serveur ; changement d’e-mail avec code, expiration et limites ; révocation par token_version ; aucun secret de service dans les composants clients.

## Validation du correctif

Le rendu réel du menu est testé en FR/KR sur Profil, son URL avec slash final et Paramètres : une seule entrée active dans Menu compte. Le rendu réel des formulaires confirme que Profil contient l’identité sans champs mot de passe/langue, et que Paramètres contient langue et sécurité sans édition du nom/téléphone. Les titres, métadonnées et routes restent privés dans le dashboard existant.


## Corrections appliquées après cet audit

Les écarts 1 à 7 ci-dessus décrivent l’état antérieur. Ils ont été traités : nom nettoyé avant validation (2–60), téléphone vide enregistré null, préférence FR/KR synchronisée avec route et cookies, action explicite de reconnexion après modification du mot de passe, codes d’erreur publics traduits sans détails internes, rafraîchissement et écran terminé après vérification du nouvel e-mail. Le contact WhatsApp fictif et la promesse 7j/7 sont retirés ; sans vrai numéro configuré, l’aide ouvre la messagerie existante. Le message WhatsApp ne préremplit plus d’adresse e-mail ou d’identité.

Aucun nouveau mécanisme de stockage, règle d’accès ou table n’a été ajouté. Les évolutions du point 8 restent des propositions hors du chantier de mise en page : avatar, préférences de notification, registre d’appareils et fermeture autonome du compte. Configurer NEXT_PUBLIC_SUPPORT_WHATSAPP avec un vrai contact est le seul complément de configuration de cet audit ; la messagerie reste accessible sans ce numéro.
