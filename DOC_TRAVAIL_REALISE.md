# Documentation des travaux realises

Ce document explique de maniere claire ce qui a ete implemente dans le projet (backend + frontend), avec le but de chaque bloc fonctionnel, les routes exposees et le parcours utilisateur.

## 1) Objectif du projet

Mettre en place un environnement de TP de programmation a distance avec:
- gestion des enseignants et etudiants,
- creation et affectation de projets par niveaux,
- depot de livrables par les etudiants,
- consultation des soumissions par les enseignants,
- execution securisee (MVP) de certaines soumissions dans un bac a sable Docker.

## 2) Evolutions backend

### 2.1 Authentification JWT et autorisation par role

Ajouts principaux:
- middleware `backend/middleware/auth.js`:
  - lecture du token Bearer (`Authorization: Bearer ...`),
  - fallback possible via `?token=...` pour les liens de telechargement,
  - injection de `req.user` (`id`, `role`),
  - helpers `requireAuth` et `requireRole(...)`.
- controllers `studentController.js` et `teacherController.js`:
  - login/register renvoient un token JWT valide 7 jours,
  - hash des mots de passe avec `bcryptjs`,
  - compatibilite legacy: migration auto si ancien mot de passe en clair.

Impact:
- les routes sensibles sont protegees par authentification + role (`student` ou `teacher`).

### 2.2 Gestion avancee des projets (CDC + references)

Fichiers touches:
- `backend/controllers/projectController.js`
- `backend/routes/projectRoutes.js`

Fonctionnalites:
- creation/mise a jour de projet avec:
  - titre, description, niveau, max etudiants,
  - resume texte de cahier des charges (`cahierDeCharge`),
  - type de reference (`repo`, `stack`, `sandbox`, `tests`, `autre`),
  - details de reference (`referenceValidation`).
- upload de fichier cahier des charges (CDC) et stockage serveur,
- remplacement/suppression du fichier CDC en edition,
- streaming securise du CDC via `GET /api/projects/:id/cdc`:
  - `inline` (apercu) ou `attachment` (telechargement) avec `?download=1`.

Notes techniques:
- suppression defensive des anciens fichiers lors d'un remplacement,
- controle d'erreurs d'upload et validation des entrees.

### 2.3 Soumissions etudiantes (upload de livrables)

Nouveaux fichiers:
- `backend/models/Submission.js`
- `backend/middleware/submissionUpload.js`
- `backend/controllers/submissionController.js`
- `backend/routes/submissionRoutes.js`
- `backend/uploads/submissions/.gitkeep`

Ce qui a ete ajoute:
- nouveau modele Mongo `Submission`:
  - liens vers `Assignment`, `Project`, `Student`,
  - metadonnees fichier (nom original, nom stocke, type MIME, taille),
  - statut de base (`submitted`/`reviewed`) + note (preparation correction).
- upload avec `multer`:
  - dossier `backend/uploads/submissions`,
  - extensions autorisees (archives + sources + docs),
  - taille max 30 Mo.
- API soumissions:
  - `POST /api/submissions` (etudiant): deposer un fichier pour une affectation active,
  - `GET /api/submissions/student/:studentId` (etudiant): historique perso,
  - `GET /api/submissions/assignment/:assignmentId` (enseignant): toutes les soumissions d'une affectation,
  - `GET /api/submissions/:id/file` (enseignant ou proprietaire): telecharger/consulter le fichier.

Controles metier:
- l'etudiant doit etre connecte,
- l'affectation doit exister et etre `en cours`,
- l'etudiant doit appartenir a l'affectation.

### 2.4 Sandbox Docker (MVP securise)

Nouveaux fichiers:
- `backend/services/dockerSandbox.js`
- `backend/controllers/sandboxController.js`
- `backend/routes/sandboxRoutes.js`

Fonctionnement:
- endpoint enseignant:
  - `POST /api/sandbox/run-submission` avec `submissionId`.
- recuperation du fichier soumis puis execution en conteneur Docker verrouille:
  - reseau desactive (`--network none`),
  - systeme en lecture seule (`--read-only`),
  - drop des capacites (`--cap-drop ALL`),
  - `no-new-privileges`,
  - limites CPU/RAM/PIDs.
- support MVP des fichiers:
  - Python (`.py`) et JavaScript (`.js`).
- timeout d'execution configurable.

Resultat renvoye:
- `ok`, `exitCode`, `timedOut`, `stdout`, `stderr`, `image`.

### 2.5 Routes branchees dans le serveur

`backend/server.js` inclut maintenant:
- `/api/submissions`
- `/api/sandbox`

et charge explicitement `backend/.env`.

### 2.6 Configuration backend

`.env.example` enrichi avec:
- `JWT_SECRET`
- configuration sandbox:
  - `SANDBOX_TIMEOUT_MS`
  - `SANDBOX_MEMORY`
  - `SANDBOX_CPUS`
  - `SANDBOX_PIDS`
  - `SANDBOX_NODE_IMAGE`
  - `SANDBOX_PY_IMAGE`

Dependances backend ajoutees/confirmees:
- `jsonwebtoken`
- `multer`
- `bcryptjs`

## 3) Evolutions frontend

### 3.1 Stockage auth centralise

Nouveau fichier:
- `frontend/src/authStorage.js`

Utilitaires:
- lecture utilisateur/token depuis `localStorage`,
- construction des headers auth (`Authorization: Bearer ...`).

Benefice:
- appels API plus coherents et plus faciles a maintenir.

### 3.2 Dashboard etudiant

Fichier majeur:
- `frontend/src/components/StudentDashboard.js`

Nouveautes:
- chargement des affectations de l'etudiant authentifie,
- schema visuel des niveaux 1 -> 5 (deverrouille / courant / verrouille),
- selection de projet au niveau courant,
- affichage du projet actif,
- zone de soumission de fichier vers `/api/submissions`,
- affichage enrichi du CDC:
  - ouverture / telechargement,
  - iframe PDF si le document est un PDF,
- presentation des references de validation par type.

### 3.3 Dashboard enseignant

Fichiers:
- `frontend/src/components/TeacherDashboard.js`
- `frontend/src/components/TeacherForms.js`
- `frontend/src/components/TeacherSubmissions.js` (nouveau)

Nouveautes cote enseignant:
- formulaires admin ameliorees:
  - creation etudiant,
  - creation projet (avec CDC fichier + references),
  - edition/suppression projet,
  - affectation de projet a un ou plusieurs etudiants.
- section `Soumissions`:
  - selection d'une affectation,
  - liste des fichiers envoyes (nom, taille, date, etudiant),
  - bouton telechargement.
- integration continue avec la vue graphe (`Diagram`) via `refreshKey`.

## 4) Flux fonctionnels couverts

### Flux enseignant
1. Se connecter.
2. Creer les etudiants (optionnel) et les projets.
3. Ajouter CDC (texte + fichier) et references.
4. Affecter un projet a des etudiants.
5. Consulter les soumissions recues.
6. Telecharger un livrable.
7. (MVP) Executer une soumission en sandbox Docker.

### Flux etudiant
1. Se connecter.
2. Voir son niveau courant et les projets disponibles.
3. Choisir un projet du niveau accessible.
4. Consulter le CDC et les references.
5. Envoyer son fichier de soumission.

## 5) API resumee (routes principales)

### Auth / utilisateurs
- `POST /api/students/register`
- `POST /api/students/login`
- `GET /api/students` (teacher)
- `POST /api/teachers/register`
- `POST /api/teachers/login`

### Projets / affectations
- `GET /api/projects`
- `POST /api/projects` (teacher)
- `PUT /api/projects/:id` (teacher)
- `DELETE /api/projects/:id` (teacher)
- `GET /api/projects/:id/cdc`
- `POST /api/assignments` (teacher)
- `POST /api/assignments/validate` (teacher)
- `GET /api/assignments/student/:studentId` (student)
- `GET /api/assignments/student/:studentId/selectable-projects` (student)
- `POST /api/assignments/student/select-project` (student)

### Soumissions / sandbox
- `POST /api/submissions` (student)
- `GET /api/submissions/student/:studentId` (student)
- `GET /api/submissions/assignment/:assignmentId` (teacher)
- `GET /api/submissions/:id/file` (teacher ou etudiant proprietaire)
- `POST /api/sandbox/run-submission` (teacher)

## 6) Securite et robustesse deja mises en place

- JWT obligatoire sur les routes privees.
- Separation stricte des roles `teacher` / `student`.
- Verifications metier avant enregistrement des soumissions.
- Filtrage des extensions + limite de taille upload.
- Suppression defensive des fichiers temporaires/obsoletes.
- Sandbox Docker executee sans reseau et avec ressources limitees.

## 7) Limites actuelles (MVP)

- execution sandbox limitee a `.py` et `.js`,
- pas encore de pipeline de correction automatique,
- pas encore de batterie de tests automatises dediee a ces nouvelles routes.

## 8) Prochaines ameliorations conseillees

- ajouter tests backend (auth, soumissions, sandbox),
- ajouter notation/commentaires enseignant sur `Submission`,
- tracer l'historique des executions sandbox,
- ajouter antivirus/scan archive avant execution,
- enrichir le tableau enseignant avec recherche/tri/export.

