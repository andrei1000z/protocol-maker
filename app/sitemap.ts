import { MetadataRoute } from 'next';
import { SITE_URL as BASE } from '@/lib/config';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { PATTERN_REFERENCE } from '@/lib/engine/patterns';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Static marketing + legal pages
  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE,                     lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/login`,          lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/privacy`,        lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,          lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/biomarkers`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/patterns`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
  ];

  // Programmatic SEO — one entry per biomarker + one per clinical pattern.
  // Changes land when BIOMARKER_DB or PATTERNS evolve; at current sizes
  // (~33 biomarkers + ~13 patterns) this stays well under search-engine
  // sitemap caps and deploys as a single static XML.
  const biomarkerEntries: MetadataRoute.Sitemap = BIOMARKER_DB.map(b => ({
    url: `${BASE}/biomarkers/${b.code.toLowerCase()}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const patternEntries: MetadataRoute.Sitemap = PATTERN_REFERENCE.map(p => ({
    url: `${BASE}/patterns/${p.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...biomarkerEntries, ...patternEntries];
}
