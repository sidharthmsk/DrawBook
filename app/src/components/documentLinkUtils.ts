export interface DocOption {
  id: string;
  name: string;
  type: string;
}

let allDocsCache: DocOption[] | null = null;
let allDocsFetchPromise: Promise<DocOption[]> | null = null;

export async function fetchAllDocs(): Promise<DocOption[]> {
  if (allDocsCache) return allDocsCache;
  if (allDocsFetchPromise) return allDocsFetchPromise;
  allDocsFetchPromise = fetch("/api/documents/names")
    .then((r) => r.json())
    .then((data) => {
      allDocsCache = data.documents || [];
      return allDocsCache!;
    })
    .catch(() => []);
  return allDocsFetchPromise;
}

export function clearAllDocsCache() {
  allDocsCache = null;
  allDocsFetchPromise = null;
}
