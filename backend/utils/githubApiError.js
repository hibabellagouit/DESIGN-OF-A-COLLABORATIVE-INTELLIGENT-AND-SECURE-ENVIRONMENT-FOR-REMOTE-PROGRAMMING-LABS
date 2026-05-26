/**
 * Messages d’erreur lisibles pour les réponses GitHub (JSON ou page HTML).
 */
export function formatGithubApiError(bodyText, status) {
  const text = String(bodyText || "").trim();
  const code = status != null ? Number(status) : null;

  if (text.startsWith("<!DOCTYPE") || text.startsWith("<html") || /<\/html>/i.test(text)) {
    if (/couldn't respond to your request in time/i.test(text)) {
      return {
        message:
          "GitHub n’a pas répondu à temps (surcharge ou limite). Réessayez dans quelques minutes.",
        status: code || 503,
      };
    }
    if (code === 403 || code === 429) {
      return {
        message:
          "Limite de l’API GitHub atteinte. Ajoutez GITHUB_TOKEN dans backend/.env puis redémarrez le serveur.",
        status: code,
      };
    }
    return {
      message: "Réponse inattendue de GitHub. Réessayez plus tard ou configurez GITHUB_TOKEN.",
      status: code || 502,
    };
  }

  try {
    const data = JSON.parse(text);
    if (data && typeof data.message === "string" && data.message) {
      return { message: data.message, status: code || data.status };
    }
  } catch {
    /* pas du JSON */
  }

  if (text.length > 240) {
    return {
      message: `Erreur GitHub${code ? ` (${code})` : ""}.`,
      status: code,
    };
  }
  return {
    message: text || `Erreur GitHub${code ? ` (${code})` : ""}.`,
    status: code,
  };
}
