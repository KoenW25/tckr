import supabase from '@/lib/supabase';

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** @returns {Promise<import('next').MetadataRoute.Sitemap>} */
export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tckr.nl';
  const routes = ['/', '/markt', '/hoe-het-werkt', '/login', '/voorwaarden', '/privacy'];

  const staticRoutes = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }));

  const { data: events } = await supabase
    .from('events')
    .select('name, date')
    .order('date', { ascending: true });

  const seen = new Set();
  const dynamicRoutes = (events ?? [])
    .map((event) => {
      const slug = slugify(event?.name);
      if (!slug || seen.has(slug)) return null;
      seen.add(slug);
      const lastModified = event?.date ? new Date(event.date) : new Date();
      return {
        url: `${baseUrl}/markt/${slug}`,
        lastModified: Number.isNaN(lastModified.getTime()) ? new Date() : lastModified,
      };
    })
    .filter(Boolean);

  return [...staticRoutes, ...dynamicRoutes];
}
