# AnyGym API

API for the anygym frontend to communicate with the database, Stripe, Auth0, and SendGrid.

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL (Neon)
- **ORM**: TypeORM
- **Language**: TypeScript

## Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database (Neon)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgresql://neondb_owner:npg_9AoyHslGRzh2@ep-aged-dream-ab20se75-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   PORT=3000
   
   # Contentful Configuration (required for content endpoints)
   CONTENTFUL_SPACE_ID=your_contentful_space_id
   CONTENTFUL_ACCESS_TOKEN=your_contentful_access_token
   CONTENTFUL_ENVIRONMENT=master  # Optional, defaults to 'master'
   ```

### Running the Application

- Development mode:
  ```bash
  npm run start:dev
  ```

- Production mode:
  ```bash
  npm run build
  npm run start:prod
  ```

The API will be available at `http://localhost:3000`

## API Endpoints

### GET /gyms

Returns all active gyms with optional filtering.

**Query Parameters:**
- `required_tier` (optional): Filter by required tier
- `amenities` (optional): Filter by amenities (comma-separated list)
- `gym_chain_id` (optional): Filter by gym chain ID

**Example Requests:**
```
GET /gyms
GET /gyms?required_tier=premium
GET /gyms?amenities=pool,sauna
GET /gyms?gym_chain_id=1
GET /gyms?required_tier=premium&amenities=pool&gym_chain_id=1
```

**Response Format:**
```json
[
  {
    "id": 1,
    "name": "Gym Name",
    "gym_chain_id": 1,
    "gym_chain_name": "Chain Name",
    "gym_chain_logo": "https://example.com/logo.png",
    "address": "123 Main St",
    "postcode": "SW1A 1AA",
    "city": "London",
    "latitude": 51.5074,
    "longitude": -0.1278,
    "required_tier": "premium",
    "amenities": ["pool", "sauna", "parking"],
    "opening_hours": {...},
    "phone": "+44 20 1234 5678",
    "image_url": "https://example.com/image.jpg"
  }
]
```

## Deployment to Render

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set the following:
   - **Build Command**: `NODE_OPTIONS=--max-old-space-size=8192 npm install && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Environment Variables**:
     - `DATABASE_URL`: Your Neon PostgreSQL connection string
     - `PORT`: (Render will set this automatically)
     - `CONTENTFUL_SPACE_ID`: Your Contentful space ID
     - `CONTENTFUL_ACCESS_TOKEN`: Your Contentful Content Delivery API access token
     - `CONTENTFUL_ENVIRONMENT`: (Optional) Contentful environment, defaults to 'master'

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts          # Root module
└── gyms/
    ├── gyms.module.ts     # Gyms feature module
    ├── gyms.controller.ts # Gyms controller
    ├── gyms.service.ts    # Gyms business logic
    ├── dto/
    │   └── get-gyms.dto.ts # DTO for query parameters
    └── entities/
        ├── gym.entity.ts      # Gym entity
        └── gym-chain.entity.ts # Gym chain entity
```

## Contentful Integration

The API includes a content service that integrates with Contentful CMS to serve articles.

### Required Environment Variables

- `CONTENTFUL_SPACE_ID`: Your Contentful space ID (found in Contentful Settings > API keys)
- `CONTENTFUL_ACCESS_TOKEN`: Your Contentful Content Delivery API access token
- `CONTENTFUL_ENVIRONMENT`: (Optional) The Contentful environment to use, defaults to 'master'

### Content Endpoints

#### GET /content/articles

Returns a paginated list of all articles from Contentful.

**Query Parameters:**
- `page` (optional): Page number, defaults to 1
- `limit` (optional): Number of articles per page, defaults to 20, max 100

**Example Request:**
```
GET /content/articles?page=1&limit=20
```

**Response Format:**
```json
{
  "results": [
    {
      "id": "article-id",
      "title": "Article Title",
      "slug": "article-slug",
      "published_date": "2024-01-01T00:00:00.000Z",
      "excerpt": "Article excerpt...",
      "featured_image": "https://images.ctfassets.net/..."
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "total_pages": 3
  }
}
```

#### GET /content/articles/:id

Returns the full content of a specific article by ID or slug.

**Path Parameters:**
- `id`: Contentful entry ID or article slug

**Example Request:**
```
GET /content/articles/article-slug
```

**Response Format:**
```json
{
  "id": "article-id",
  "title": "Article Title",
  "slug": "article-slug",
  "body": { ... },
  "featuredImage": { ... },
  ... // All fields from Contentful
}
```

## Notes

- Only gyms with `status = 'active'` are returned
- The API uses TypeORM for database operations
- CORS is enabled for frontend communication
- Validation is enabled for all incoming requests
- Content endpoints are public and do not require authentication

