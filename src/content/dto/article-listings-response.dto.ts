import { ArticleListingItemDto } from './article-listing-item.dto';

export class ArticleListingsResponseDto {
  results: ArticleListingItemDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

