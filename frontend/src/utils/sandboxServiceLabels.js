/**
 * Libellés pédagogiques pour les services docker compose (prof).
 */
export function getSandboxServicePresentation(service, containerPort) {
  const name = String(service || "").toLowerCase();
  const port = Number(containerPort);

  const looksFrontend =
    /front|web|ui|client|nginx|www|react|vue|angular|static/.test(name) ||
    port === 80 ||
    port === 443 ||
    port === 5173 ||
    port === 4200;
  const looksBackend =
    /back|api|server|node|express|nest|django|flask|spring/.test(name) ||
    port === 3000 ||
    port === 5000 ||
    port === 8000;

  if (looksFrontend && !looksBackend) {
    return {
      title: "Interface web (frontend)",
      hint: "Page à ouvrir dans le navigateur (site React, nginx, etc.).",
      primary: true,
    };
  }
  if (looksBackend && !looksFrontend) {
    return {
      title: "API backend",
      hint: "Réponses JSON / API — ce n’est en général pas la page d’accueil du site.",
      primary: false,
    };
  }
  return {
    title: String(service || "Service"),
    hint: "Service du projet étudiant.",
    primary: false,
  };
}
