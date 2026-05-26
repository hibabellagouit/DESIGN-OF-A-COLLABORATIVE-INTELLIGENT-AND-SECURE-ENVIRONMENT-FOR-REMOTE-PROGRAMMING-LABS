# Guide : docker-compose à la racine

Les projets de la plateforme sont testés avec **Docker Compose**. Le fichier de description doit être trouvé **à la racine** du dépôt ou du dossier envoyé, sans sous-dossier intermédiaire.

## Nom du fichier

- `docker-compose.yml` **ou**
- `docker-compose.yaml`

Pas d’autre nom (`compose.yml`, `docker/compose.yaml`, etc.) pour la détection automatique.

## Structure correcte

```
mon-projet/
├── docker-compose.yml    ← ici
├── README.md
├── frontend/
│   └── Dockerfile, src…
└── backend/
    └── Dockerfile, src…
```

## Cas fréquents

| Situation | Attendu |
|-----------|---------|
| Fichiers multiples (navigateur) | Chemin relatif `docker-compose.yml` sans préfixe (`projet/docker-compose.yml` est refusé si le préfixe n’est pas vide à la racine d’envoi) |
| Dossier entier (webkitdirectory) | Le compose doit apparaître comme `docker-compose.yml` ou `NomDossier/docker-compose.yml` selon ce que vous sélectionnez — préférez sélectionner la **racine du projet** |
| Une seule archive `.zip` | À l’extraction, `docker-compose.yml` doit être **directement** à la racine du ZIP |
| Dépôt **GitHub** | Fichier visible sur `https://github.com/org/repo/blob/main/docker-compose.yml` (pas dans `src/`) |

## Contenu recommandé du compose

- Au moins deux **services** (ex. `frontend`, `backend`).
- Section **`ports:`** pour exposer l’interface web et l’API (tests sandbox du professeur).
- Commandes utiles en local :

```bash
docker compose config    # valide le YAML
docker compose up        # démarre la stack
docker compose down      # arrête
```

## Vérification dans l’application

- **Étudiant** : page **Soumission** → bouton *Guide : docker-compose à la racine* → checklist en temps réel (fichiers) ou vérification GitHub (API).
- **Enseignant** : fiche projet → chaque soumission affiche la checklist ; bouton **Tester (compose)** si le compose est à la racine.

## API (optionnel)

`POST /api/submissions/compose-checklist`

```json
{ "mode": "files", "paths": ["docker-compose.yml", "backend/app.js"] }
```

```json
{ "mode": "github", "githubUrl": "https://github.com/org/projet" }
```

Réponse : `{ "items": [...], "ready": true|false, "blockingFail": boolean }`.

## Référence enseignant

Le **docker-compose de référence** joint au projet (cahier des charges) sert de modèle ; chaque équipe livre **son propre** fichier compose à la racine de sa soumission.
