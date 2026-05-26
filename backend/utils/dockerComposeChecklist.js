import {
  isDockerComposeBasename,
  relativePathIsRootDockerCompose,
  uploadBasenamesIncludeRootDockerCompose,
} from "./dockerComposePaths.js";

function normalizePath(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function pathsIncludeComposeBasename(paths) {
  return paths.some((p) => {
    const norm = normalizePath(p);
    const base = norm.split("/").pop() || "";
    return isDockerComposeBasename(base);
  });
}

function pathsWithNestedComposeOnly(paths) {
  const hasNested = paths.some((p) => {
    const norm = normalizePath(p);
    const parts = norm.split("/").filter(Boolean);
    if (parts.length <= 1) return false;
    return isDockerComposeBasename(parts[parts.length - 1]);
  });
  const hasRoot = uploadBasenamesIncludeRootDockerCompose(paths);
  return hasNested && !hasRoot;
}

/**
 * Checklist pédagogique avant soumission / test sandbox.
 * @param {{ relativePaths?: string[], isGithub?: boolean, githubComposeOk?: boolean|null, githubUrlValid?: boolean|null }} input
 */
export function buildDockerComposeChecklist(input = {}) {
  const paths = (input.relativePaths || []).map(normalizePath).filter(Boolean);
  const isGithub = Boolean(input.isGithub);
  const githubOk = input.githubComposeOk;
  const githubUrlValid = input.githubUrlValid;

  const atRoot = uploadBasenamesIncludeRootDockerCompose(paths);
  const hasComposeName = pathsIncludeComposeBasename(paths);
  const nestedOnly = pathsWithNestedComposeOnly(paths);
  const singleZip =
    paths.length === 1 && /\.zip$/i.test(paths[0]) && !paths[0].includes("/");

  const items = [];

  if (isGithub) {
    items.push({
      id: "github_url",
      label: "Lien GitHub valide (github.com/…)",
      status:
        githubUrlValid === true ? "ok" : githubUrlValid === false ? "fail" : "pending",
      detail: "Format https://github.com/organisation/projet (ou .git)",
    });
    items.push({
      id: "compose_root_github",
      label: "docker-compose.yml ou .yaml à la racine du dépôt",
      status:
        githubOk === true ? "ok" : githubOk === false ? "fail" : "pending",
      detail:
        githubOk === false
          ? "Le fichier doit être visible à la racine sur GitHub (pas dans un sous-dossier)."
          : "Vérification via l’API GitHub à la soumission ou via « Vérifier ».",
    });
  } else {
    items.push({
      id: "compose_file",
      label: "Fichier nommé docker-compose.yml ou docker-compose.yaml",
      status: hasComposeName || atRoot ? "ok" : "fail",
      detail: hasComposeName
        ? "Un fichier compose a été repéré dans la sélection."
        : "Ajoutez docker-compose.yml (ou .yaml) à votre projet.",
    });
    items.push({
      id: "compose_root",
      label: "docker-compose à la racine (pas dans un sous-dossier)",
      status: atRoot ? "ok" : nestedOnly ? "fail" : hasComposeName ? "warn" : "fail",
      detail: atRoot
        ? singleZip
          ? "Archive ZIP : le compose doit être à la racine du ZIP."
          : "Chemin attendu : docker-compose.yml (sans préfixe de dossier)."
        : nestedOnly
          ? "Ex. incorrect : src/docker-compose.yml — déplacez le fichier à la racine."
          : "Ex. correct : docker-compose.yml à côté de README, Dockerfile, etc.",
    });
    if (singleZip) {
      items.push({
        id: "zip_root",
        label: "Archive .zip unique : racine du ZIP = racine du projet",
        status: atRoot ? "ok" : "warn",
        detail:
          "Structure ZIP : projet.zip → docker-compose.yml, frontend/, backend/…",
      });
    }
  }

  items.push({
    id: "services_ports",
    label: "Services frontend + backend avec ports publiés (recommandé)",
    status: "info",
    detail:
      "Dans le compose : services distincts (ex. frontend, backend), section ports: pour ouvrir l’app dans le navigateur.",
  });
  items.push({
    id: "local_test",
    label: "Test local : docker compose config puis docker compose up",
    status: "info",
    detail:
      "Sur votre machine : à la racine du projet, docker compose config (valide le YAML) puis docker compose up.",
  });

  const requiredIds = isGithub
    ? ["compose_root_github"]
    : ["compose_file", "compose_root"];
  const blockingFail = items.some(
    (it) => requiredIds.includes(it.id) && it.status === "fail"
  );
  const ready =
    isGithub && githubOk === true
      ? true
      : !isGithub && atRoot && (hasComposeName || atRoot) && !nestedOnly
        ? true
        : !isGithub && atRoot && !blockingFail;

  return { items, ready: Boolean(ready), blockingFail };
}
