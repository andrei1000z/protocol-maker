import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/tracking', '/history', '/settings', '/onboarding'] },
    ],
    sitemap: 'https://protocol-tawny.vercel.app/sitemap.xml',
  };
}
