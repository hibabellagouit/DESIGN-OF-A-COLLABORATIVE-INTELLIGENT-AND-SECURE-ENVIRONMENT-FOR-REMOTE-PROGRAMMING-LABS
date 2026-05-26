export const DOCKER_COMPOSE_SUBMIT_REQUIRED_MESSAGE =
  "Les tests du projet sont exécutés dans Docker : le dépôt doit inclure docker-compose.yml " +
  "(ou docker-compose.yaml) à la racine des fichiers remis ou à la racine d'une archive .zip.";

export { uploadBasenamesIncludeRootDockerCompose as uploadBasenamesIncludeDockerCompose } from "./dockerComposePaths.js";
