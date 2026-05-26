# Sécurité — TP Projets

## Secrets

- Ne commitez jamais `.env` : `JWT_SECRET`, `MONGODB_URI`, `GITHUB_TOKEN`, clés admin.
- Changez `JWT_SECRET` en production (valeur longue et aléatoire).

## Authentification

- API protégée par JWT (`Authorization: Bearer`).
- Rôles : `student`, `teacher`, `admin` — vérifiés par middleware.

## Sandbox Docker

- Réservé aux enseignants (`POST /api/sandbox/run-submission`, `POST /api/jobs/sandbox`).
- Les ports hôte sont remappés dynamiquement (`0:port`) pour limiter les conflits.
- **Durcissement** (par défaut, `SANDBOX_COMPOSE_HARDEN=true`) :
  - Fichier override `docker-compose.sandbox-hardening.yml` : capabilities dangereuses retirées (sans `cap_drop: ALL`, compatible nginx/Node), `no-new-privileges`, limites CPU/RAM/PIDs, `tmpfs` sur `/tmp` et chemins nginx.
  - Par défaut, si les conteneurs restent actifs pour le prof (`SANDBOX_KEEP_CONTAINERS_UP`), le réseau sandbox **n’est pas** `internal` afin que les ports soient joignables depuis `127.0.0.1`. Mettre `SANDBOX_NETWORK_INTERNAL=true` pour un isolement maximal (sans liens navigateur).
  - Réseau `internal` (pas d’Internet sortant) si `SANDBOX_NETWORK_INTERNAL=true`.
  - Audit du `docker compose config` : refus socket Docker, `privileged`, `network_mode: host`, montages système sensibles.
  - Maximum `SANDBOX_MAX_CONCURRENT` tests en parallèle sur le serveur.
  - `COMPOSE_DISABLE_ENV_FILE=1` pour ne pas charger un `.env` étudiant non contrôlé.
- En production : exécuter le backend avec accès Docker minimal ; ne pas monter le socket Docker dans les projets étudiants.

## Ollama (IA)

- Service local recommandé ; ne pas exposer Ollama sur Internet sans authentification.
- Les notes IA sont **indicatives** ; la note officielle est celle de l’enseignant (équipe /20).

## Fichiers uploadés

- Stockage local `uploads/` — sauvegardes et quotas disque à prévoir.
- Valider les types MIME côté serveur (multer + extensions).

## Signalement

Pour une faille : contactez l’administrateur de la plateforme ou ouvrez une issue privée sur le dépôt.
