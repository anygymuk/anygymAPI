import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as express from 'express';
import type { Request, Response, NextFunction } from 'express';

function isSwaggerDocsPath(path: string): boolean {
  return path === '/docs-json' || path === '/docs' || path.startsWith('/docs/');
}

function swaggerBasicAuthMiddleware(
  username: string,
  password: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isSwaggerDocsPath(req.path)) {
      next();
      return;
    }

    const header = req.headers.authorization;
    if (!header?.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="AnyGym API docs"');
      res.status(401).send('Authentication required');
      return;
    }

    let decoded: string;
    try {
      decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    } catch {
      res.setHeader('WWW-Authenticate', 'Basic realm="AnyGym API docs"');
      res.status(401).send('Invalid credentials');
      return;
    }

    const colon = decoded.indexOf(':');
    const user = colon === -1 ? decoded : decoded.slice(0, colon);
    const pass = colon === -1 ? '' : decoded.slice(colon + 1);

    if (user !== username || pass !== password) {
      res.setHeader('WWW-Authenticate', 'Basic realm="AnyGym API docs"');
      res.status(401).send('Invalid credentials');
      return;
    }

    next();
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend communication
  app.enableCors();

  // Configure raw body for Stripe webhook
  // Stripe requires raw body for signature verification
  app.use('/stripe/checkout', express.raw({ type: 'application/json' }));
  app.use('/stripe/updates', express.raw({ type: 'application/json' }));

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  let swaggerEnabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true';

  const swaggerDocsPassword = process.env.SWAGGER_DOCS_PASSWORD;
  const isProduction = process.env.NODE_ENV === 'production';

  if (swaggerEnabled && isProduction && !swaggerDocsPassword) {
    console.warn(
      'Swagger UI is disabled in production: set SWAGGER_DOCS_PASSWORD (and optionally SWAGGER_DOCS_USER) to serve /docs securely.',
    );
    swaggerEnabled = false;
  }

  if (swaggerEnabled) {
    if (swaggerDocsPassword) {
      const swaggerDocsUser = process.env.SWAGGER_DOCS_USER || 'docs';
      app.use(swaggerBasicAuthMiddleware(swaggerDocsUser, swaggerDocsPassword));
    }

    const config = new DocumentBuilder()
      .setTitle('AnyGym API')
      .setDescription(
        'REST API for AnyGym. Authenticated routes expect the Auth0 subject in the `auth0_id` header (also accepts `auth0-id`).',
      )
      .setVersion('1.0')
      .addApiKey(
        {
          type: 'apiKey',
          name: 'auth0_id',
          in: 'header',
          description: 'Auth0 user id (subject). Required on protected routes.',
        },
        'auth0_id',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`OpenAPI UI: http://localhost:${port}/docs`);
    console.log(`OpenAPI JSON: http://localhost:${port}/docs-json`);
    if (swaggerDocsPassword) {
      console.log(
        `Docs are protected with HTTP Basic Auth (user: ${process.env.SWAGGER_DOCS_USER || 'docs'}).`,
      );
    }
  }
}
bootstrap();

