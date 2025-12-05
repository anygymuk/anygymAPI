export class ArticleListingItemDto {
  id: string;
  title: string;
  headline: string | null;
  slug: string;
  published_date: Date | null;
  excerpt: string | null;
  featured_image: string | null;
  featured_image_alt: string | null;
}

