# Guide enseignant

## Démarrage

1. Backend : `cd backend && npm install && npm start`
2. Frontend : `cd frontend && npm install && npm start`
3. Créer un compte enseignant via l’interface ou l’API.

## Créer un projet

- **Gestion** → Créer un projet : titre, niveau, **docker-compose.yml obligatoire**, date limite optionnelle.
- Le fichier compose sert de référence pour les tests Docker des soumissions.
- Les soumissions étudiantes doivent avoir leur propre `docker-compose.yml` **à la racine** (checklist sur la fiche projet). Guide : [guide-docker-compose-racine.md](./guide-docker-compose-racine.md).

## Notation

- Ouvrir le **graphe** → cliquer un projet → fiche projet.
- Noter l’**équipe /20** (50 % de la note finale).
- Les **50 % commits GitHub** sont calculés automatiquement après synchronisation des dépôts.

## À traiter

- Menu **À traiter** : équipes sans soumission, sans note, sandbox en échec.
- **Exporter CSV** : toutes les notes par étudiant et projet.

## Tests Docker & IA (file d’attente)

Avec **Redis** (`REDIS_URL`) et le worker (`npm run worker`) :

- **Docker** : bouton « Tester (compose) » → `POST /api/jobs/sandbox` (non bloquant).
- **Ollama** : « Lancer l’évaluation IA » → `POST /api/jobs/ollama`.

Sans Redis : file en mémoire (même API, un seul processus).

Variables utiles : `SANDBOX_COMPOSE_MODE=fast`, `QUEUE_CONCURRENCY=2`.

## Santé système

- `GET /api/health` : MongoDB, Docker, Ollama, paramètres sandbox.
