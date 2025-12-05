export class ArticleListingItemDto {
  id: string;
  title: string;
  slug: string;
  published_date: Date | null;
  excerpt: string | null;
  featured_image: string | null;
}

