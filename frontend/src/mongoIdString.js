/** ID Mongo utilisable dans l’URL ou l’API (évite "[object Object]"). */
export function mongoIdString(ref) {
  if (ref == null) return "";
  if (typeof ref === "string") {
    const t = ref.trim();
    return t === "[object Object]" ? "" : t;
  }
  if (typeof ref === "object") {
    if (ref.$oid != null) return mongoIdString(ref.$oid);
    if (ref._id != null) return mongoIdString(ref._id);
    if (typeof ref.toHexString === "function") return ref.toHexString();
    if (typeof ref.toString === "function") {
      const s = ref.toString();
      if (s && s !== "[object Object]") return s;
    }
  }
  return "";
}
