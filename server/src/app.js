import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import crypto from 'node:crypto'
import db, { initDatabase } from './db.js'
import { ogImageBuffer } from './og-image.js'

const app = express()
const ADMIN_COOKIE = 'veloura_admin'
const SESSION_TTL_MS = 1000 * 60 * 60 * 12

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }))
app.use(express.json({ limit: '200kb' }))

app.get('/api/og-image.jpg', (_req, res) => {
  res.set({
    'Content-Type': 'image/jpeg',
    'Content-Length': ogImageBuffer.length,
    'Cache-Control': 'public, max-age=86400, s-maxage=86400',
  })
  res.send(ogImageBuffer)
})

app.use(async (_req, res, next) => {
  try {
    await initDatabase()
    next()
  } catch (error) {
    console.error('Database initialization failed:', error)
    res.status(500).json({ message: 'Database is not ready.' })
  }
})

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((pair) => {
    const index = pair.indexOf('=')
    return [decodeURIComponent(pair.slice(0, index)), decodeURIComponent(pair.slice(index + 1))]
  }))
}

function adminConfig() {
  const email = process.env.ADMIN_EMAIL || (process.env.NODE_ENV !== 'production' ? 'admin@veloura.store' : '')
  const password = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'veloura-admin' : '')
  const secret = process.env.ADMIN_SESSION_SECRET || (process.env.NODE_ENV !== 'production' ? 'veloura-dev-secret-change-me' : '')
  return { email, password, secret }
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb)
}

function createSession(email) {
  const { secret } = adminConfig()
  const expires = Date.now() + SESSION_TTL_MS
  const payload = `${email}|${expires}`
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(`${payload}|${signature}`).toString('base64url')
}

function verifySession(token) {
  const { email, secret } = adminConfig()
  if (!token || !email || !secret) return false
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const [sessionEmail, expiresRaw, signature] = decoded.split('|')
    const payload = `${sessionEmail}|${expiresRaw}`
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    return sessionEmail === email && Number(expiresRaw) > Date.now() && safeEqual(signature, expected)
  } catch {
    return false
  }
}

function setAdminCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure ? '; Secure' : ''}`)
}

function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

function requireAdmin(req, res, next) {
  const token = parseCookies(req.headers.cookie || '')[ADMIN_COOKIE]
  if (!verifySession(token)) return res.status(401).json({ message: 'Admin authentication required.' })
  next()
}

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalizeProduct(body, existing = {}) {
  const name = String(body.name ?? existing.name ?? '').trim()
  const category = String(body.category ?? existing.category ?? '').trim()
  const price = Number(body.price ?? existing.price ?? 0)
  const stock = Number(body.stock ?? existing.stock ?? 0)
  const featured = body.featured === true || body.featured === 1 || body.featured === '1' ? 1 : 0
  const slug = slugify(body.slug || name || existing.slug)
  const description = String(body.description ?? existing.description ?? '').trim()
  const benefits = String(body.benefits ?? existing.benefits ?? '').trim()
  const image = String(body.image ?? existing.image ?? '/products/placeholder.svg').trim() || '/products/placeholder.svg'
  if (!name || !category || !slug || !description || !benefits) throw new Error('Name, category, description and benefits are required.')
  if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a valid positive number.')
  if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock must be a whole number of 0 or more.')
  return { name, slug, category, price, description, benefits, image, stock, featured }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'veloura-api' }))

app.get('/api/products', async (req, res) => {
  const { category, search, featured } = req.query
  const conditions = []
  const args = []
  if (category && category !== 'All') { conditions.push('category = ?'); args.push(category) }
  if (search) { conditions.push('(name LIKE ? OR description LIKE ?)'); args.push(`%${search}%`, `%${search}%`) }
  if (featured === 'true') conditions.push('featured = 1')
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await db.execute({ sql: `SELECT * FROM products ${where} ORDER BY featured DESC, id ASC`, args })
  res.json(result.rows)
})

app.get('/api/products/:id', async (req, res) => {
  const result = await db.execute({ sql: 'SELECT * FROM products WHERE id = ?', args: [req.params.id] })
  const product = result.rows[0]
  if (!product) return res.status(404).json({ message: 'Product not found' })
  res.json(product)
})

app.post('/api/orders', async (req, res) => {
  const { customerName, email, phone, address, city, notes = '', items } = req.body
  if (!customerName || !email || !phone || !address || !city || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Please complete the checkout form and add at least one product.' })
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })

  const tx = await db.transaction('write')
  try {
    let total = 0
    const resolved = []
    for (const item of items) {
      const result = await tx.execute({ sql: 'SELECT id, name, price, stock FROM products WHERE id = ?', args: [item.id] })
      const product = result.rows[0]
      const quantity = Number(item.quantity)
      if (!product || !Number.isInteger(quantity) || quantity < 1) throw new Error('One or more cart items are invalid.')
      if (Number(product.stock) < quantity) throw new Error(`${product.name} only has ${product.stock} item(s) left.`)
      total += Number(product.price) * quantity
      resolved.push({ ...product, quantity })
    }

    const orderNumber = `VEL-${Date.now().toString().slice(-8)}-${Math.floor(100 + Math.random() * 900)}`
    const orderResult = await tx.execute({
      sql: 'INSERT INTO orders (order_number, customer_name, email, phone, address, city, notes, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [orderNumber, customerName.trim(), email.trim().toLowerCase(), phone.trim(), address.trim(), city.trim(), notes.trim(), total],
    })

    for (const item of resolved) {
      await tx.execute({
        sql: 'INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)',
        args: [orderResult.lastInsertRowid, item.id, item.name, item.price, item.quantity],
      })
      await tx.execute({ sql: 'UPDATE products SET stock = stock - ? WHERE id = ?', args: [item.quantity, item.id] })
    }

    await tx.commit()
    res.status(201).json({ orderNumber, total, status: 'pending', message: 'Order created successfully.' })
  } catch (error) {
    await tx.rollback()
    res.status(400).json({ message: error.message || 'Could not create order.' })
  }
})

app.get('/api/orders/:orderNumber', async (req, res) => {
  const orderResult = await db.execute({ sql: 'SELECT * FROM orders WHERE order_number = ?', args: [req.params.orderNumber] })
  const order = orderResult.rows[0]
  if (!order) return res.status(404).json({ message: 'Order not found' })
  const itemsResult = await db.execute({ sql: 'SELECT product_id, product_name, price, quantity FROM order_items WHERE order_id = ?', args: [order.id] })
  res.json({ ...order, items: itemsResult.rows })
})

// Admin authentication
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {}
  const config = adminConfig()
  if (!config.email || !config.password || !config.secret) {
    return res.status(503).json({ message: 'Admin access has not been configured on this environment.' })
  }
  if (!safeEqual(String(email || '').toLowerCase(), config.email.toLowerCase()) || !safeEqual(password || '', config.password)) {
    return res.status(401).json({ message: 'Invalid email or password.' })
  }
  setAdminCookie(res, createSession(config.email))
  res.json({ ok: true, email: config.email })
})

app.post('/api/admin/logout', (_req, res) => {
  clearAdminCookie(res)
  res.json({ ok: true })
})

app.get('/api/admin/me', requireAdmin, (_req, res) => {
  res.json({ authenticated: true, email: adminConfig().email })
})

// Admin dashboard
app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
  const [productStats, orderStats, recentOrders, lowStock] = await Promise.all([
    db.execute('SELECT COUNT(*) AS total_products, COALESCE(SUM(stock),0) AS total_units, SUM(CASE WHEN stock <= 5 THEN 1 ELSE 0 END) AS low_stock FROM products'),
    db.execute("SELECT COUNT(*) AS total_orders, COALESCE(SUM(total),0) AS revenue, COUNT(DISTINCT email) AS customers, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending FROM orders"),
    db.execute('SELECT id, order_number, customer_name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 6'),
    db.execute('SELECT id, name, category, stock, price, image FROM products WHERE stock <= 5 ORDER BY stock ASC, name ASC LIMIT 8'),
  ])
  res.json({
    products: productStats.rows[0],
    orders: orderStats.rows[0],
    recentOrders: recentOrders.rows,
    lowStock: lowStock.rows,
  })
})

// Admin products
app.get('/api/admin/products', requireAdmin, async (req, res) => {
  const search = String(req.query.search || '').trim()
  const category = String(req.query.category || '').trim()
  const conditions = []
  const args = []
  if (search) { conditions.push('(name LIKE ? OR slug LIKE ? OR description LIKE ?)'); args.push(`%${search}%`, `%${search}%`, `%${search}%`) }
  if (category && category !== 'All') { conditions.push('category = ?'); args.push(category) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await db.execute({ sql: `SELECT * FROM products ${where} ORDER BY id DESC`, args })
  res.json(result.rows)
})

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const p = normalizeProduct(req.body)
    const result = await db.execute({
      sql: 'INSERT INTO products (name, slug, category, price, description, benefits, image, stock, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [p.name, p.slug, p.category, p.price, p.description, p.benefits, p.image, p.stock, p.featured],
    })
    const created = await db.execute({ sql: 'SELECT * FROM products WHERE id = ?', args: [result.lastInsertRowid] })
    res.status(201).json(created.rows[0])
  } catch (error) {
    res.status(400).json({ message: error.message.includes('UNIQUE') ? 'A product with this slug already exists.' : error.message })
  }
})

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const current = (await db.execute({ sql: 'SELECT * FROM products WHERE id = ?', args: [req.params.id] })).rows[0]
    if (!current) return res.status(404).json({ message: 'Product not found.' })
    const p = normalizeProduct(req.body, current)
    await db.execute({
      sql: 'UPDATE products SET name=?, slug=?, category=?, price=?, description=?, benefits=?, image=?, stock=?, featured=? WHERE id=?',
      args: [p.name, p.slug, p.category, p.price, p.description, p.benefits, p.image, p.stock, p.featured, req.params.id],
    })
    const updated = await db.execute({ sql: 'SELECT * FROM products WHERE id = ?', args: [req.params.id] })
    res.json(updated.rows[0])
  } catch (error) {
    res.status(400).json({ message: error.message.includes('UNIQUE') ? 'A product with this slug already exists.' : error.message })
  }
})

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const linked = await db.execute({ sql: 'SELECT COUNT(*) AS count FROM order_items WHERE product_id = ?', args: [req.params.id] })
  if (Number(linked.rows[0]?.count || 0) > 0) {
    return res.status(409).json({ message: 'This product belongs to an existing order and cannot be deleted. Set stock to 0 instead.' })
  }
  await db.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [req.params.id] })
  res.json({ ok: true })
})

// Admin orders
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const search = String(req.query.search || '').trim()
  const status = String(req.query.status || '').trim()
  const conditions = []
  const args = []
  if (search) { conditions.push('(order_number LIKE ? OR customer_name LIKE ? OR email LIKE ? OR phone LIKE ?)'); args.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`) }
  if (status && status !== 'All') { conditions.push('status = ?'); args.push(status.toLowerCase()) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await db.execute({ sql: `SELECT * FROM orders ${where} ORDER BY id DESC`, args })
  res.json(result.rows)
})

app.get('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const order = (await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] })).rows[0]
  if (!order) return res.status(404).json({ message: 'Order not found.' })
  const items = await db.execute({ sql: 'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', args: [order.id] })
  res.json({ ...order, items: items.rows })
})

app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const allowed = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
  const status = String(req.body?.status || '').toLowerCase()
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid order status.' })
  const current = (await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] })).rows[0]
  if (!current) return res.status(404).json({ message: 'Order not found.' })
  await db.execute({ sql: 'UPDATE orders SET status = ? WHERE id = ?', args: [status, req.params.id] })
  const updated = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [req.params.id] })
  res.json(updated.rows[0])
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: 'Unexpected server error.' })
})

export default app
