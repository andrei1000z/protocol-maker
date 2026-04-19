import { MetadataRoute } from 'next';
import { SITE_URL as BASE } from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE,                 lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/login`,      lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/privacy`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,      lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];
}
