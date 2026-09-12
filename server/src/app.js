import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import db, { initDatabase } from './db.js'
import { ogImageBuffer } from './og-image.js'

const app = express()

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }))
app.use(express.json({ limit: '100kb' }))

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

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: 'Unexpected server error.' })
})

export default app
