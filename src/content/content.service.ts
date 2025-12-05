import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'contentful';
import { ArticleListingItemDto } from './dto/article-listing-item.dto';
import { ArticleListingsResponseDto } from './dto/article-listings-response.dto';
import { ArticleResponseDto } from './dto/article-response.dto';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);
  private contentfulClient: ReturnType<typeof createClient>;

  constructor(private configService: ConfigService) {
    const spaceId = this.configService.get<string>('CONTENTFUL_SPACE_ID');
    const accessToken = this.configService.get<string>('CONTENTFUL_ACCESS_TOKEN');
    const environment = this.configService.get<string>('CONTENTFUL_ENVIRONMENT') || 'master';

    if (!spaceId || !accessToken) {
      this.logger.error('Contentful configuration missing: CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN are required');
      throw new Error('Contentful configuration is missing');
    }

    this.contentfulClient = createClient({
      space: spaceId,
      accessToken: accessToken,
      environment: environment,
    });

    this.logger.log(`Contentful client initialized for space: ${spaceId}, environment: ${environment}`);
  }

  async getAllArticles(page: number = 1, limit: number = 20): Promise<ArticleListingsResponseDto> {
    try {
      this.logger.log(`Fetching articles - page: ${page}, limit: ${limit}`);

      const skip = (page - 1) * limit;

      const response = await this.contentfulClient.getEntries({
        content_type: 'article',
        skip: skip,
        limit: limit,
        order: ['-sys.createdAt'], // Order by creation date descending (newest first)
      });

      const articles: ArticleListingItemDto[] = response.items.map((item) => {
        const fields = item.fields as any;
        
        // Extract featured image URL from heroImage if available
        // heroImage has structure: fields.image[0].url or fields.image[0].secure_url
        let featuredImageUrl: string | null = null;
        let featuredImageAlt: string | null = null;
        
        if (fields.heroImage && fields.heroImage.fields) {
          // Extract alt text
          featuredImageAlt = fields.heroImage.fields.altText || null;
          
          // Extract image URL from the image array
          if (fields.heroImage.fields.image && Array.isArray(fields.heroImage.fields.image) && fields.heroImage.fields.image.length > 0) {
            const imageData = fields.heroImage.fields.image[0];
            // Prefer secure_url if available, otherwise use url
            featuredImageUrl = imageData.secure_url || imageData.url || null;
          }
        }

        return {
          id: item.sys.id,
          title: fields.title || '',
          slug: fields.slug || '',
          published_date: fields.publishedDate ? new Date(fields.publishedDate) : null,
          excerpt: fields.excerpt || null,
          featured_image: featuredImageUrl,
          featured_image_alt: featuredImageAlt,
        };
      });

      const totalPages = Math.ceil(response.total / limit);

      return {
        results: articles,
        pagination: {
          total: response.total,
          page: page,
          limit: limit,
          total_pages: totalPages,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching articles: ${error.message}`, error.stack);
      throw new Error(`Failed to fetch articles: ${error.message}`);
    }
  }

  async getArticleById(id: string): Promise<ArticleResponseDto> {
    try {
      this.logger.log(`Fetching article with ID: ${id}`);

      // First, try to get by entry ID
      try {
        const entry = await this.contentfulClient.getEntry(id);
        
        // Transform the entry to include all fields
        const article: ArticleResponseDto = {
          id: entry.sys.id,
          ...this.transformEntryFields(entry.fields),
        };

        return article;
      } catch (entryError: any) {
        // If not found by ID, try to find by slug
        // Contentful throws errors with specific properties
        const isNotFound = entryError.response?.status === 404 || 
                          entryError.status === 404 ||
                          entryError.message?.includes('not found') ||
                          entryError.message?.includes('NotFound');
        
        if (isNotFound) {
          this.logger.log(`Article not found by ID, trying to find by slug: ${id}`);
          
          try {
            const response = await this.contentfulClient.getEntries({
              content_type: 'article',
              'fields.slug': id,
              limit: 1,
            });

            if (response.items.length === 0) {
              throw new NotFoundException(`Article not found: ${id}`);
            }

            const entry = response.items[0];
            const article: ArticleResponseDto = {
              id: entry.sys.id,
              ...this.transformEntryFields(entry.fields),
            };

            return article;
          } catch (slugError: any) {
            // If slug lookup also fails, throw NotFoundException
            throw new NotFoundException(`Article not found: ${id}`);
          }
        }
        throw entryError;
      }
    } catch (error) {
      this.logger.error(`Error fetching article: ${error.message}`, error.stack);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new Error(`Failed to fetch article: ${error.message}`);
    }
  }

  /**
   * Transform Contentful entry fields, handling rich text and linked assets
   */
  private transformEntryFields(fields: any): any {
    const transformed: any = {};

    for (const key in fields) {
      if (fields.hasOwnProperty(key)) {
        const value = fields[key];

        // Handle linked assets (images, files)
        if (value && typeof value === 'object' && value.sys && value.sys.type === 'Link' && value.sys.linkType === 'Asset') {
          // This is a linked asset reference - we'll need to resolve it
          // For now, store the link ID
          transformed[key] = value;
        } else if (value && typeof value === 'object' && value.fields && value.fields.file) {
          // This is an asset with file data
          transformed[key] = {
            url: `https:${value.fields.file.url}`,
            title: value.fields.title || null,
            description: value.fields.description || null,
            contentType: value.fields.file.contentType || null,
            fileName: value.fields.file.fileName || null,
            size: value.fields.file.details?.size || null,
            width: value.fields.file.details?.image?.width || null,
            height: value.fields.file.details?.image?.height || null,
          };
        } else if (Array.isArray(value)) {
          // Handle arrays (e.g., array of links, array of rich text)
          transformed[key] = value.map((item) => {
            if (item && typeof item === 'object' && item.fields) {
              return this.transformEntryFields(item.fields);
            }
            return item;
          });
        } else if (value && typeof value === 'object' && value.nodeType) {
          // Rich text field
          transformed[key] = value;
        } else {
          // Regular field
          transformed[key] = value;
        }
      }
    }

    return transformed;
  }
}

