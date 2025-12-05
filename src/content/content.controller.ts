import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
  NotFoundException,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { ArticleListingsResponseDto } from './dto/article-listings-response.dto';
import { ArticleResponseDto } from './dto/article-response.dto';

@Controller('content')
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(private readonly contentService: ContentService) {}

  @Get('articles')
  async getArticles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('category') category?: string,
  ): Promise<ArticleListingsResponseDto> {
    try {
      this.logger.log(`GET /content/articles called - page: ${page}, limit: ${limit}, category: ${category || 'none'}`);
      
      // Validate pagination parameters
      if (page < 1) {
        page = 1;
      }
      if (limit < 1 || limit > 100) {
        limit = 20; // Default limit if invalid
      }

      const result = await this.contentService.getAllArticles(page, limit, category);
      return result;
    } catch (error) {
      this.logger.error(`Error in getArticles: ${error.message}`, error.stack);
      
      // Re-throw NotFoundException for category not found
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw error;
    }
  }

  @Get('articles/:id')
  async getArticleById(@Param('id') id: string): Promise<ArticleResponseDto> {
    try {
      this.logger.log(`GET /content/articles/${id} called`);
      
      if (!id) {
        throw new NotFoundException('Article ID is required');
      }

      const article = await this.contentService.getArticleById(id);
      return article;
    } catch (error) {
      this.logger.error(`Error in getArticleById: ${error.message}`, error.stack);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw error;
    }
  }
}

