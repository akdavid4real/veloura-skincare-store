# Veloura Skincare Store

A simple full-stack e-commerce website for women's skincare and creams.

## Stack
- React + Vite frontend
- Express backend
- SQLite locally via libSQL
- Turso Serverless SQLite in production
- Vercel hosting

## Features
- Responsive skincare storefront
- 20 seeded skincare products
- Product search and category filters
- Product details
- Cart with quantity controls and local persistence
- Checkout form
- SQLite-backed products, orders, and order items
- Stock validation and stock deduction when an order is created
- REST API for products and orders

## Run locally

```bash
npm install
npm run install:all
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:4000
Health: http://localhost:4000/api/health

Local development uses `file:./server/data/veloura.db` automatically.

## Deploy on Vercel

1. Import `akdavid4real/veloura-skincare-store` into Vercel.
2. Keep the project root as the repository root.
3. Vercel uses `vercel.json` to build `client/dist` and route `/api/*` to the Express function.
4. In the Vercel Marketplace, add **Turso Cloud** to the project.
5. Create/connect a Turso Serverless SQLite database.
6. Confirm these environment variables are available in the Vercel project:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
7. Redeploy.
8. Verify `/api/health`, then place a test order from the storefront.

The database schema and 20 starter products are created automatically on the first API request.

## Product images

Final product renders belong in:

`client/public/products/`

The 20 reserved filenames are documented in `client/public/products/README.md`. Missing files fall back to `placeholder.svg`, so the storefront remains usable while the final visuals are being produced.

## API
- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders`
- `GET /api/orders/:orderNumber`
