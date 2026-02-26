type SourceLabelInput = {
  documentName?: string | null;
  source?: string | null;
};

const decodeUriComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const extractSourceFilename = (source: string | null | undefined) => {
  if (typeof source !== "string") {
    return null;
  }

  const trimmed = source.trim();
  if (!trimmed) {
    return null;
  }

  let pathOrUrl = trimmed;

  try {
    pathOrUrl = new URL(trimmed).pathname;
  } catch {
    pathOrUrl = trimmed;
  }

  const normalized = pathOrUrl.split(/[?#]/, 1)[0]?.replaceAll("\\", "/") ?? "";
  const filename = normalized
    .split("/")
    .filter((segment) => segment.length > 0)
    .at(-1);

  if (!filename) {
    return null;
  }

  const decoded = decodeUriComponentSafe(filename).replaceAll("+", " ").trim();
  return decoded || null;
};

export const getSourceName = (input: SourceLabelInput) => {
  const name =
    typeof input.documentName === "string" ? input.documentName.trim() : "";

  if (name) {
    return name;
  }

  return extractSourceFilename(input.source);
};

export const getSourceLabel = (input: SourceLabelInput) =>
  getSourceName(input) ?? "Unknown source";

const normalizeSourceKey = (value: string) => value.trim().toLowerCase();

export const dedupeBySourceName = <T extends SourceLabelInput>(items: T[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const name = getSourceName(item);
    if (!name) {
      return true;
    }

    const key = normalizeSourceKey(name);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};
