export function getEmagSearchUrl(query: string): string {
  return `https://www.emag.ro/search/${encodeURIComponent(query)}`;
}

export function getEmagSupplementUrl(name: string, form?: string): string {
  const query = form ? `${name} ${form}` : name;
  return getEmagSearchUrl(query);
}

export function getFarmaciaTeiUrl(query: string): string {
  return `https://www.farmaciatei.ro/cauta?q=${encodeURIComponent(query)}`;
}

export function getCatenaUrl(query: string): string {
  return `https://www.catena.ro/cauta/${encodeURIComponent(query)}`;
}

export function getStoreUrl(name: string, store: string): string {
  switch (store.toLowerCase()) {
    case 'emag': return getEmagSearchUrl(name);
    case 'farmacia tei': return getFarmaciaTeiUrl(name);
    case 'catena': return getCatenaUrl(name);
    default: return getEmagSearchUrl(name);
  }
}
