# Un salut ne crée aucun ticket

Cause vérifiée : le plan JSON du modèle pouvait donner human=open/confirm, et le service prenait ce champ comme autorisation d’appeler open_support_ticket. Le formulaire distingue bien Envoyer du bouton de ticket ; le problème est dans le contrôle serveur.

Le service établit désormais le consentement depuis le message étudiant réellement enregistré et l’état de confirmation de la conversation, indépendamment du modèle. Une salutation est traitée sans appel IA, sans recherche ni lecture de données de compte, sans notification et sans proposition automatique de ticket. Même un ancien indicateur requestTicket sur une salutation ne suffit pas. Une erreur du modèle peut au plus proposer un transfert. Les refus et questions expliquant comment créer un ticket n’autorisent aucune ouverture.

Les ouvertures autorisées (bouton dédié avec son texte, demande explicite ou confirmation d’une proposition active) sont tracées dans l’état serveur. Le modèle ne fournit plus d’autorisation d’ouverture dans son contrat. Les tickets actifs gardent leur priorité, les messages existants sont conservés. Un ticket déjà créé reste à résoudre via le contrôle administratif existant ; aucune suppression ou résolution automatique de tickets légitimes.

Tests locaux : Salut/Bonjour/Bonjou/Hello, ancien transfert proposé, ancien indicateur bouton, modèle erroné open/confirm, refus et demandes d’explication, demande explicite FR/HT, confirmation et vrai bouton. Services simulés ; aucun ticket, e-mail ou message de test en production. Aucune migration SQL nécessaire.
