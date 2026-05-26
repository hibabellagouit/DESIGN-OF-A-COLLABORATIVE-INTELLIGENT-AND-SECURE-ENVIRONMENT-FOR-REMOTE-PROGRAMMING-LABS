import fs from "fs";

/**
 * Remplace les ports hôte fixes (ex. 3000:3000) par des ports dynamiques (0:3000)
 * pour éviter les conflits avec le frontend local ou d’autres conteneurs.
 */
export function patchComposeContentForSandbox(content) {
  let patched = String(content || "");

  patched = patched.replace(
    /(^(\s*-\s*)(['"]?))(\d{1,5}):(\d{1,5})(\3\s*$)/gm,
    (_m, _line, prefix, quote, _host, container) => `${prefix}${quote}0:${container}${quote}`
  );

  patched = patched.replace(
    /(^\s*)(['"]?)(\d{1,5}):(\d{1,5})(\2\s*$)/gm,
    (m, indent, quote, host, container, q2) => {
      if (!/^\d{1,5}:\d{1,5}$/.test(`${host}:${container}`)) return m;
      if (m.includes("node:") || m.includes("sha256:")) return m;
      return `${indent}${quote}0:${container}${q2}`;
    }
  );

  return patched;
}

export function patchComposeFileForSandbox(composeFilePath) {
  const raw = fs.readFileSync(composeFilePath, "utf8");
  const patched = patchComposeContentForSandbox(raw);
  if (patched === raw) return { composeFilePath, patched: false };

  const outPath = composeFilePath.replace(/\.ya?ml$/i, ".sandbox.yml");
  fs.writeFileSync(outPath, patched, "utf8");
  return { composeFilePath: outPath, patched: true };
}

export function isPortBindConflict(stderr = "", stdout = "") {
  const text = `${stderr}\n${stdout}`;
  return /port is already allocated|failed programming external connectivity|Bind for .* failed/i.test(
    text
  );
}

export function composeBuildLikelySucceeded(stderr = "", stdout = "") {
  const text = `${stderr}\n${stdout}`;
  return /Built|exporting to image|DONE\s*$/im.test(text);
}
