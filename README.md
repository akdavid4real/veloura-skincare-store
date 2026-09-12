# Veloura Skincare Store

A simple full-stack e-commerce website for women's skincare and creams.

## Stack
- React + Vite frontend
- Express backend
- SQLite database via better-sqlite3

## Features
- Responsive skincare storefront
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

## Production

```bash
npm run build
npm start
```

In production, the Express server serves `client/dist` if it exists.

## API
- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders`
- `GET /api/orders/:orderNumber`
