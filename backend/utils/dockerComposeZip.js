import AdmZip from "adm-zip";
import { zipEntryIsRootDockerCompose } from "./dockerComposePaths.js";

/** Vérification best-effort (archive mal formée ⇒ false). Compose requis à la racine du ZIP. */
export function zipFileContainsDockerCompose(zipAbsolutePath) {
  try {
    const zip = new AdmZip(zipAbsolutePath);
    return zip.getEntries().some((e) => {
      if (e.isDirectory) return false;
      return zipEntryIsRootDockerCompose(e.entryName);
    });
  } catch {
    return false;
  }
}
