export class ArticleResponseDto {
  id: string;
  [key: string]: any; // Allow all fields from Contentful to be included
}

