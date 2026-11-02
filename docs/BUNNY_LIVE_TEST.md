# Bunny Stream : configuration et essai réel

Bibliothèque existante : **Faro Video**, ID public `793214`. Aucun changement des clés ni création de bibliothèque, aucun ajout de formation dans Supabase.

## Réglages vérifiés et corrigés dans Bunny
- Lecture directe : désactivée.
- Domaines autorisés : `faroschool.com` et `*.faroschool.com`.
- Blocage des accès directs sans référent : actif.
- Authentification par jeton CDN : active.
- **Authentification par jeton du lecteur intégré : activée pendant cette intervention** ; elle était désactivée.
- **Webhook d’encodage : `https://faroschool.com/api/webhooks/bunny`, enregistré et vérifié après rechargement** ; le champ était vide.
- La route du site répond 401 à un événement non signé, pas 503 de configuration manquante. La réception complète d’un futur événement Bunny doit être vérifiée lors du prochain envoi depuis le site, sans accès SQL distant par l’agent.

## Vidéo réellement envoyée
Un petit MP4 H.264 technique a été généré localement puis envoyé par le véritable fournisseur et le client TUS de l’application, vers la bibliothèque existante.
- Nom : `Faro School — TEST TECHNIQUE — 3 secondes`.
- Identifiant Bunny : `c9951608-10eb-4a62-be4b-834d4f3bfd4f`.
- Fichier : `docs/test-media/faro-school-bunny-test.mp4`, 17 637 octets.
- État prestataire : encodé (`status=4`), progression 100 %, durée retournée par Bunny 2 s. La durée n’est pas celle inventée par le navigateur.
- Aucun autre média existant supprimé ou remplacé ; le média technique reste disponible dans Bunny pour le propriétaire.

## Lecture protégée vérifiée
Avec le référent Faro School : jeton valide → véritable lecteur ; jeton invalide ou absent → page de refus. Bunny renvoie HTTP 200 même pour cette page de refus « 403 » : vérifier uniquement le statut HTTP aurait donné un faux résultat. Les corps et jetons signés ne sont pas enregistrés dans le dépôt.

Preuves sans secrets : `docs/test-media/bunny-live-result.json` et `docs/screenshots/course-upload/bunny-security-configured.png`. Le test ne prouve pas encore une lecture depuis un compte élève réel sur iPhone ; ce contrôle nécessite une leçon enregistrée par le propriétaire. Les réglages et envois sont ceux de Bunny ; aucune donnée de cours créée dans Supabase.

Documentation primaire : https://bunny.net/blog/bunny-stream-introducing-pre-signed-and-resumable-uploads/ ; protocole TUS https://tus.io/protocols/resumable-upload ; sécurité de bibliothèque https://docs.bunny.net/reference/videolibrarypublic_update.
