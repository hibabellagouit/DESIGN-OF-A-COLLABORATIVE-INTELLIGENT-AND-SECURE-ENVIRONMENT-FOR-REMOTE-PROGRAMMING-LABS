# Guide administrateur

## Premier admin

- Variables `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` au démarrage du backend, ou
- `POST /api/admin/first-setup` avec `ADMIN_FIRST_SETUP_KEY`.

## Tableau de bord admin

- Utilisateurs, politique de sécurité, journal d’audit.

## Déploiement

- Voir `deploy/docker-compose.yml` : MongoDB + backend + frontend (build statique).
- Configurer `JWT_SECRET`, `MONGODB_URI`, `OLLAMA_BASE_URL` dans l’environnement du backend.

## CI

- GitHub Actions : tests backend (`npm test`) + build frontend.

## Santé

- Surveiller `GET /api/health` (`ready: true` si MongoDB connecté).
