# Tests backend

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run test:unit` | Utilitaires + smoke API (sans Mongo) |
| `npm run test:integration` | Intégration (Mongo local + mocks GitHub/sandbox) |
| `npm run test:integration:memory` | Intégration avec Mongo en mémoire (~150 Mo, 1er téléchargement) |
| `npm test` | Unit + intégration |
| `npm run lint` | ESLint |
| `npm run audit:ci` | `npm audit` (échec si vulnérabilité **high+**) |

`npm run test:integration` définit déjà les variables nécessaires (CMD, PowerShell, bash).

## Prérequis intégration

**MongoDB** doit tourner en local sur le port 27017 (base `tp_projets_integration` créée automatiquement).

- Installer [MongoDB Community](https://www.mongodb.com/try/download/community) ou lancer via Docker :

```cmd
docker run -d -p 27017:27017 --name mongo-test mongo:7
```

Sans Mongo installé :

```cmd
npm run test:integration:memory
```

(premier lancement : téléchargement du binaire Mongo en mémoire).

## Variables manuelles (optionnel)

**Invite de commandes CMD** (pas PowerShell) :

```cmd
set MONGODB_URI_TEST=mongodb://127.0.0.1:27017/tp_projets_integration
set INTEGRATION_TEST_MOCK_GITHUB=true
set INTEGRATION_TEST_MOCK_SANDBOX=true
npm run test:integration
```

**PowerShell** :

```powershell
$env:MONGODB_URI_TEST="mongodb://127.0.0.1:27017/tp_projets_integration"
$env:INTEGRATION_TEST_MOCK_GITHUB="true"
$env:INTEGRATION_TEST_MOCK_SANDBOX="true"
npm run test:integration
```

Ne pas utiliser `$env:...` dans CMD : cela provoque l’erreur « syntaxe du nom de fichier incorrecte ».

## Redis / BullMQ (sandbox + Ollama)

Sans `REDIS_URL` : file **en mémoire** (comportement par défaut, y compris pour `npm run test:integration`).

Production / dev avec Redis :

```cmd
docker run -d -p 6379:6379 --name redis-test redis:7-alpine
```

Dans `backend\.env` :

```
REDIS_URL=redis://127.0.0.1:6379
QUEUE_RUN_WORKER_IN_API=true
```

- **Terminal 1** : `npm start` (API)
- **Terminal 2** (si pas `QUEUE_RUN_WORKER_IN_API=true`) : `npm run worker`

API : `POST /api/jobs/sandbox`, `POST /api/jobs/ollama`, suivi via `GET /api/jobs/:id`.
