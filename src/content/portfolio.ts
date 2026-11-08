// Default portfolio photos (optimized AVIF + JPEG at 640px and 1800px) and
// helpers that normalize database rows into the same shape.

const assetUrls = import.meta.glob('../assets/portfolio/*.{jpg,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const asset = (slug: string, size: 640 | 1800, ext: 'jpg' | 'avif') =>
  assetUrls[`../assets/portfolio/${slug}-${size}.${ext}`] || '';

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  category: string;
  subCategory: string;
  /** Large JPEG (lightbox / hero). */
  src: string;
  /** Small JPEG (grid). */
  thumb: string;
  thumbAvif?: string;
  largeAvif?: string;
  isFeatured?: boolean;
  displayOrder?: number;
  /** Older identifiers (legacy ids, original file hashes, old URLs) used for favorites matching. */
  legacyKeys: string[];
  isDefault?: boolean;
}

interface DefaultPhoto {
  id: string;
  slug: string;
  hash: string;
  title: string;
  description: string;
  category: string;
  subCategory: string;
  featured?: boolean;
}

const DEFAULT_PHOTOS: DefaultPhoto[] = [
  { id: 'bgc-series-1', slug: 'bgc-series-1', hash: '3105c16fd3359cada5a0747c5cd838ca4df26c60', title: 'BGC Series 1', description: 'Street Photography', category: 'portrait', subCategory: 'street', featured: true },
  { id: 'jimmy-bondoc-singing', slug: 'jimmy-bondoc', hash: '6f3048cc6713529e980a3f4b5d6f42c3184c8018', title: 'Jimmy Bondoc Singing', description: 'Street Party Concert', category: 'events', subCategory: 'concert', featured: true },
  { id: 'olivia-1st-birthday', slug: 'olivia-1st-birthday', hash: '09af3496bde7cedf90ff53e0f6c1ca15a60c8df0', title: 'Olivia 1st Birthday', description: '1st Birthday Celebration', category: 'events', subCategory: 'birthday', featured: true },
  { id: 'mirasol-couple', slug: 'mirasol-couple', hash: 'c689b0258f6d963b52098e2478216817945b5a12', title: 'Mirasol Couple', description: 'Couple Shoot', category: 'portrait', subCategory: 'couple' },
  { id: 'retro-beauty-neon-glow', slug: 'retro-beauty-neon-glow', hash: '81a34d1a3320f8ef4bade6ae80a98b976c361c7a', title: 'Retro Beauty, Neon Glow', description: 'Park Shoot', category: 'portrait', subCategory: 'outdoor' },
  { id: 'joy-xix', slug: 'joy-xix', hash: '720b8a4a052529d0f1b4d58ef1d206f61e2e686f', title: 'JOY XIX', description: 'Joylyn Birthday Shoot', category: 'events', subCategory: 'birthday' },
  { id: 'blooms-in-blue', slug: 'blooms-in-blue', hash: '5d507fa4d3d1f609abc52c4c1ff182f7a6404312', title: 'Blooms in Blue', description: 'Graduation Shoot', category: 'portrait', subCategory: 'graduation' },
  { id: 'bgc-series-2', slug: 'bgc-series-2', hash: 'df206be07003a0d76653908219e6526c60d86459', title: 'BGC Series 2', description: 'Street Photography', category: 'portrait', subCategory: 'street' },
  { id: 'indak-sa-ginintuang-imbayog', slug: 'indak', hash: 'eee20487d43dc85a611e30f24dfcb08b32b5d169', title: 'Indak Sa Ginintuang Imbayog', description: 'School Concert', category: 'events', subCategory: 'school' },
  { id: 'bgc-series-3', slug: 'bgc-series-3', hash: '0e14a3c3ca32d5ea70a593d1c05cda9b87f03f77', title: 'BGC Series 3', description: 'Slaying the Streets', category: 'portrait', subCategory: 'street' },
  { id: 'spiral-stairway', slug: 'spiral-stairway', hash: 'dbe79d24605c5d7c7fecc9071d8e44d31fbf9ae7', title: 'Spiral Stairway', description: 'Ronac Art Center - Stairway', category: 'creative', subCategory: 'architecture' },
  { id: 'bgc-series-4', slug: 'bgc-series-4', hash: '29a16cf877620509ac819745d295174ca581ff3e', title: 'BGC Series 4', description: 'Bro Shoot', category: 'portrait', subCategory: 'casual' },
];

const toDefaultItem = (photo: DefaultPhoto, index: number): PortfolioItem => ({
  id: photo.id,
  title: photo.title,
  description: photo.description,
  category: photo.category,
  subCategory: photo.subCategory,
  src: asset(photo.slug, 1800, 'jpg'),
  thumb: asset(photo.slug, 640, 'jpg'),
  thumbAvif: asset(photo.slug, 640, 'avif'),
  largeAvif: asset(photo.slug, 1800, 'avif'),
  isFeatured: Boolean(photo.featured),
  displayOrder: index,
  legacyKeys: [photo.id, photo.slug, photo.hash],
  isDefault: true,
});

export const DEFAULT_PORTFOLIO: PortfolioItem[] = DEFAULT_PHOTOS.map(toDefaultItem);

export const HERO_IDS = ['bgc-series-1', 'jimmy-bondoc-singing', 'olivia-1st-birthday', 'mirasol-couple', 'retro-beauty-neon-glow'];
export const HERO_PHOTOS = HERO_IDS
  .map((id) => DEFAULT_PORTFOLIO.find((item) => item.id === id))
  .filter(Boolean) as PortfolioItem[];

const findDefaultByUrl = (url: string) =>
  DEFAULT_PHOTOS.find((photo) => url.includes(photo.hash) || url.includes(`/${photo.slug}-`));

/** Convert a portfolio_images row (or legacy object) into a PortfolioItem. */
export const normalizePortfolioRow = (row: any, index: number): PortfolioItem => {
  const rawUrl: string = row.image_url || row.url || row.src || row.imageData || '';
  const matchedDefault = rawUrl.startsWith('data:') ? undefined : findDefaultByUrl(rawUrl);
  const optimized = matchedDefault ? toDefaultItem(matchedDefault, index) : undefined;

  return {
    id: String(row.id || `portfolio-${index}`),
    title: row.title || optimized?.title || `Portfolio Item ${index + 1}`,
    description: row.description || optimized?.description || '',
    category: row.category || optimized?.category || 'portrait',
    subCategory: row.subcategory || row.subCategory || optimized?.subCategory || '',
    src: optimized?.src || rawUrl,
    thumb: optimized?.thumb || row.thumbnail_url || rawUrl,
    thumbAvif: optimized?.thumbAvif,
    largeAvif: optimized?.largeAvif,
    isFeatured: Boolean(row.is_featured ?? row.isFeatured),
    displayOrder: Number(row.display_order ?? row.displayOrder ?? index),
    legacyKeys: [rawUrl, ...(optimized?.legacyKeys || [])].filter(Boolean),
    isDefault: false,
  };
};

export const itemMatchesKey = (item: PortfolioItem, key: string) =>
  item.id === key || item.src === key || item.legacyKeys.some((legacy) => legacy === key || (legacy.length >= 20 && key.includes(legacy)));

export const PORTFOLIO_CATEGORIES = [
  {
    name: 'Portrait',
    value: 'portrait',
    subCategories: [
      { name: 'Street', value: 'street' },
      { name: 'Outdoor', value: 'outdoor' },
      { name: 'Casual', value: 'casual' },
      { name: 'Graduation', value: 'graduation' },
      { name: 'Couple', value: 'couple' },
    ],
  },
  {
    name: 'Events',
    value: 'events',
    subCategories: [
      { name: 'Birthday', value: 'birthday' },
      { name: 'Concert', value: 'concert' },
      { name: 'School', value: 'school' },
      { name: 'Corporate', value: 'corporate' },
      { name: 'Festival', value: 'festival' },
    ],
  },
  {
    name: 'Creative',
    value: 'creative',
    subCategories: [
      { name: 'Architecture', value: 'architecture' },
      { name: 'Abstract', value: 'abstract' },
      { name: 'Fine Art', value: 'fineart' },
      { name: 'Conceptual', value: 'conceptual' },
      { name: 'Editorial', value: 'editorial' },
    ],
  },
  {
    name: 'Commercial',
    value: 'commercial',
    subCategories: [
      { name: 'Product', value: 'product' },
      { name: 'Fashion', value: 'fashion' },
      { name: 'Food', value: 'food' },
      { name: 'Lifestyle', value: 'lifestyle' },
      { name: 'Brand', value: 'brand' },
    ],
  },
  {
    name: 'Documentary',
    value: 'documentary',
    subCategories: [
      { name: 'Wedding', value: 'wedding' },
      { name: 'Travel', value: 'travel' },
      { name: 'Reportage', value: 'reportage' },
      { name: 'Candid', value: 'candid' },
      { name: 'Photojournalism', value: 'photojournalism' },
    ],
  },
];

export const categoryLabel = (value?: string) =>
  PORTFOLIO_CATEGORIES.find((category) => category.value === value)?.name || value || '';

export const subCategoryLabel = (category?: string, value?: string) =>
  PORTFOLIO_CATEGORIES.find((entry) => entry.value === category)?.subCategories.find((sub) => sub.value === value)?.name || value || '';
