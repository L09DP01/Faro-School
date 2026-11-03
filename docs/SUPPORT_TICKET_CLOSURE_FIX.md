# Résoudre un ticket ferme sa discussion

Le comportement précédent résolvait les escalades puis réaffectait la conversation à AI_RESUMED/ai_handling. Cela contredisait la clôture demandée : le ticket restait affiché ouvert.

La fonction SQL de contrôle ferme désormais la conversation avant de résoudre les escalades, sous le même verrou. Les triggers ne peuvent donc pas réouvrir la discussion. Une nouvelle fermeture répétée est sans effet supplémentaire ; un élève ou un intervenant non autorisé ne peut fermer ou réouvrir le ticket. Les réponses IA tardives sont refusées et l’historique reste lisible. Une nouvelle demande utilise une nouvelle conversation indépendante.

La migration 20261103020000 corrige uniquement les anciennes résolutions suivies d’aucun échange étudiant, intervenant ou IA. Elle ne touche pas aux tickets actifs ni aux conversations ayant continué après résolution. Aucun message n’est supprimé. L’article officiel Support est actualisé seulement s’il n’a pas été modifié par l’administration ; sa version précédente est conservée.

Le serveur vérifie le statut réellement enregistré avant d’annoncer le succès. L’administration affiche Clôturé au lieu de remettre la discussion en IA. L’étudiant consulte les anciens messages avec une saisie désactivée. Tests PostgreSQL locaux et interface FR/HT mobile/desktop ; aucune donnée de test en production. Le propriétaire a confirmé l’application de la migration.

Les éléments clôturés sont exclus de Tous et des catégories actives, côté administrateur et étudiant. Ils restent uniquement dans Clôturés/Fèmen ; les compteurs Tous comptent les discussions actives. Une clôture administrative bascule vers les archives et les liens directs vers un ancien ticket conservent leur lecture seule.
