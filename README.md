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
   PASS_EXPIRY_CRON_ENABLED=true  # Optional, defaults to true

   # SendGrid (optional — form emails skipped when unset)
   SENDGRID_API_KEY=your_sendgrid_api_key
   SENDGRID_FROM_EMAIL=hello@any-gym.com
   FORM_NOTIFICATION_EMAIL=team@any-gym.com
   ```

### Database migrations

Run the SQL files in `migrations/` against your PostgreSQL database before using the leads endpoints:

```bash
psql "$DATABASE_URL" -f migrations/001_create_newsletter_subscriptions.sql
psql "$DATABASE_URL" -f migrations/002_create_gym_group_enquiries.sql
psql "$DATABASE_URL" -f migrations/003_create_investor_enquiries.sql
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

Render free/starter instances have a **512MB RAM limit**. Avoid high `max-old-space-size` values during build or startup.

1. Connect your GitHub repository to Render
2. Create a new Web Service (or use the included `render.yaml` blueprint)
3. Set the following:
   - **Build Command**: `npm ci && NODE_OPTIONS=--max-old-space-size=384 npm run build && npm prune --omit=dev`
   - **Start Command**: `NODE_ENV=production NODE_OPTIONS=--max-old-space-size=460 node dist/main`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `DATABASE_URL`: Your Neon PostgreSQL connection string
     - `PORT`: (Render will set this automatically)
     - `CONTENTFUL_SPACE_ID`: Your Contentful space ID
     - `CONTENTFUL_ACCESS_TOKEN`: Your Contentful Content Delivery API access token
     - `CONTENTFUL_ENVIRONMENT`: (Optional) Contentful environment, defaults to 'master'
     - `PASS_EXPIRY_CRON_ENABLED`: (Optional) Set to `false` to disable the every-minute pass expiry cron job and reduce memory use

If the service still OOMs on the 512MB plan, upgrade to a Render instance with more RAM or set `PASS_EXPIRY_CRON_ENABLED=false`.

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

## Leads Endpoints (public)

Marketing site forms post to these endpoints. No authentication required. Rate limited to 5 requests per minute per IP.

### POST /leads/newsletter

Subscribe to the newsletter.

**Request body:**
```json
{
  "email": "user@example.com",
  "consent": true
}
```

### POST /leads/gym-group

Submit a gym group partnership enquiry.

**Request body:**
```json
{
  "contactName": "Jane Smith",
  "email": "jane@example.com",
  "companyName": "FitChain Ltd",
  "locations": "6-10",
  "phone": "+44 7700 900000",
  "message": "Optional message"
}
```

`locations` must be one of: `1-5`, `6-10`, `11-20`, `21-50`, `50+`.

### POST /leads/investor

Submit an investor enquiry.

**Request body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "company": "Acme Capital",
  "investmentRange": "100k-500k",
  "message": "Optional message"
}
```

`investmentRange` (optional) must be one of: `under-100k`, `100k-500k`, `500k-1m`, `1m-plus`, `strategic`.

**Success response (all endpoints):**
```json
{
  "success": true,
  "emailSent": true,
  "saved": true
}
```

**Error response:**
```json
{
  "error": "Human-readable error message"
}
```

Newsletter and gym-group submissions are persisted first; if email delivery fails the request still succeeds with `emailSent: false`. Investor enquiries return 500 when SendGrid is configured but email delivery fails, even if the row was saved.

## Notes

- Only gyms with `status = 'active'` are returned
- The API uses TypeORM for database operations
- CORS is enabled for frontend communication
- Validation is enabled for all incoming requests
- Content endpoints are public and do not require authentication

