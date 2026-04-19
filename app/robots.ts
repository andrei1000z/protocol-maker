import { MetadataRoute } from 'next';
import { SITE_URL as BASE } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacy', '/terms', '/login', '/share/'],
        disallow: [
          '/api/',
          '/dashboard',
          '/tracking',
          '/history',
          '/settings',
          '/onboarding',
          '/chat',
        ],
      },
      // Allow rich snippet generation by the big search + social crawlers
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
      { userAgent: 'DuckDuckBot', allow: '/' },
      { userAgent: 'Twitterbot', allow: '/' },
      { userAgent: 'facebookexternalhit', allow: '/' },
      { userAgent: 'LinkedInBot', allow: '/' },
      { userAgent: 'Slackbot', allow: '/' },
      { userAgent: 'Discordbot', allow: '/' },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
