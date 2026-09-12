# Veloura Skincare Store

A full-stack e-commerce website for women's skincare and creams.

## Stack
- React + Vite frontend
- Express backend
- SQLite locally via libSQL
- Turso Serverless SQLite in production
- Vercel hosting

## Storefront features
- Responsive skincare storefront
- 20 seeded skincare products
- Product search and category filters
- Product details
- Cart with quantity controls and local persistence
- Checkout form
- SQLite-backed products, orders, and order items
- Stock validation and stock deduction when an order is created

## Admin workspace
Admin is available at `/admin` and includes:
- Secure admin login with HttpOnly session cookie
- Dashboard stats for orders, revenue, customers, products and stock
- Recent orders and low-stock alerts
- Product listing
- Create/edit products
- Price, stock, category, image URL and featured-product management
- Safe product deletion rules
- Inventory view
- Order listing and search
- Order detail drawer
- Status flow: pending, confirmed, shipped, delivered, cancelled
- Protected `/api/admin/*` endpoints

## Run locally

```bash
npm install
npm run install:all
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:4000
Admin: http://localhost:5173/admin
Health: http://localhost:4000/api/health

Local development uses `file:./server/data/veloura.db` automatically.

Local admin fallback credentials are intentionally development-only:
- Email: `admin@veloura.store`
- Password: `veloura-admin`

## Production environment variables

Required on Vercel:

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=use-a-strong-unique-password
ADMIN_SESSION_SECRET=use-a-long-random-secret-at-least-32-characters
```

Do not commit real credentials to the repository.

## Deploy on Vercel

1. Import `akdavid4real/veloura-skincare-store` into Vercel.
2. Keep the project root as the repository root.
3. Vercel uses `vercel.json` to build `client/dist` and route `/api/*` to the Express functions.
4. Connect Turso and confirm `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` exist for Production.
5. Add the three admin environment variables above for Production.
6. Redeploy.
7. Verify `/api/health`, `/api/products`, `/admin`, then place a test order.

The database schema and 20 starter products are created automatically on the first successful API request.

## Product images

Final product renders belong in:

`client/public/products/`

The 20 reserved filenames are documented in `client/public/products/README.md`. Missing files fall back to `placeholder.svg`, so the storefront remains usable while the final visuals are being produced.

## Public API
- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders`
- `GET /api/orders/:orderNumber`

## Admin API
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/dashboard`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id/status`
