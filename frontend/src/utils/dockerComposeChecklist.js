const COMPOSE_NAMES = new Set(["docker-compose.yml", "docker-compose.yaml"]);

function normalizePath(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function isComposeBasename(name) {
  return COMPOSE_NAMES.has(String(name || "").toLowerCase());
}

function relativePathIsRootDockerCompose(relativePath) {
  const norm = normalizePath(relativePath).toLowerCase();
  return COMPOSE_NAMES.has(norm);
}

function pathsFromFileList(fileList) {
  return Array.from(fileList || []).map((f) =>
    normalizePath(f.webkitRelativePath || f.name || "")
  );
}

export function buildDockerComposeChecklistFromPaths(relativePaths) {
  const paths = (relativePaths || []).map(normalizePath).filter(Boolean);
  const atRoot = paths.some(relativePathIsRootDockerCompose);
  const hasComposeName = paths.some((p) => {
    const base = p.split("/").pop() || "";
    return isComposeBasename(base);
  });
  const nestedOnly =
    paths.some((p) => {
      const parts = p.split("/").filter(Boolean);
      return parts.length > 1 && isComposeBasename(parts[parts.length - 1]);
    }) && !atRoot;
  const singleZip = paths.length === 1 && /\.zip$/i.test(paths[0]) && !paths[0].includes("/");

  const items = [
    {
      id: "compose_file",
      label: "Fichier docker-compose.yml ou .yaml présent",
      status: hasComposeName || atRoot ? "ok" : "fail",
      detail: hasComposeName
        ? "Fichier compose repéré dans la sélection."
        : "Ajoutez docker-compose.yml à votre projet.",
    },
    {
      id: "compose_root",
      label: "docker-compose à la racine (pas dans un sous-dossier)",
      status: atRoot ? "ok" : nestedOnly ? "fail" : hasComposeName ? "warn" : "fail",
      detail: atRoot
        ? singleZip
          ? "ZIP : le compose doit être à la racine de l’archive."
          : "Chemin attendu : docker-compose.yml (sans dossier parent)."
        : nestedOnly
          ? "Incorrect : ex. src/docker-compose.yml — placez le fichier à la racine."
          : "Correct : docker-compose.yml à côté du README, des dossiers frontend/, backend/, etc.",
    },
  ];

  if (singleZip) {
    items.push({
      id: "zip_root",
      label: "Archive .zip : racine du ZIP = racine du projet",
      status: atRoot ? "ok" : "warn",
      detail: "À l’intérieur du ZIP : docker-compose.yml directement, pas dans un sous-dossier.",
    });
  }

  items.push(
    {
      id: "services_ports",
      label: "Services frontend + backend avec ports (recommandé)",
      status: "info",
      detail: "Nommez les services (frontend, backend) et exposez des ports pour le test sandbox.",
    },
    {
      id: "local_test",
      label: "Test local : docker compose config && docker compose up",
      status: "info",
      detail: "Validez le YAML puis lancez la stack avant de soumettre.",
    }
  );

  const ready = atRoot && !nestedOnly;
  return { items, ready, blockingFail: !ready };
}

export function buildDockerComposeChecklistFromFiles(files) {
  return buildDockerComposeChecklistFromPaths(pathsFromFileList(files));
}

export { pathsFromFileList };
