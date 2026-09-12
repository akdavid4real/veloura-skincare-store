import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import db, { initDatabase } from './db.js'

initDatabase()

const app = express()
const PORT = process.env.PORT || 4000
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'veloura-api' }))

app.get('/api/products', (req, res) => {
  const { category, search, featured } = req.query
  const conditions = []
  const params = []
  if (category && category !== 'All') { conditions.push('category = ?'); params.push(category) }
  if (search) { conditions.push('(name LIKE ? OR description LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
  if (featured === 'true') conditions.push('featured = 1')
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const products = db.prepare(`SELECT * FROM products ${where} ORDER BY featured DESC, id ASC`).all(...params)
  res.json(products)
})

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!product) return res.status(404).json({ message: 'Product not found' })
  res.json(product)
})

app.post('/api/orders', (req, res) => {
  const { customerName, email, phone, address, city, notes = '', items } = req.body
  if (!customerName || !email || !phone || !address || !city || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Please complete the checkout form and add at least one product.' })
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })

  try {
    const createOrder = db.transaction(() => {
      let total = 0
      const resolved = items.map((item) => {
        const product = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ?').get(item.id)
        const quantity = Number(item.quantity)
        if (!product || !Number.isInteger(quantity) || quantity < 1) throw new Error('One or more cart items are invalid.')
        if (product.stock < quantity) throw new Error(`${product.name} only has ${product.stock} item(s) left.`)
        total += product.price * quantity
        return { ...product, quantity }
      })

      const orderNumber = `VEL-${Date.now().toString().slice(-8)}-${Math.floor(100 + Math.random() * 900)}`
      const result = db.prepare(`INSERT INTO orders (order_number, customer_name, email, phone, address, city, notes, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(orderNumber, customerName.trim(), email.trim().toLowerCase(), phone.trim(), address.trim(), city.trim(), notes.trim(), total)

      const addItem = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)')
      const reduceStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
      resolved.forEach((item) => {
        addItem.run(result.lastInsertRowid, item.id, item.name, item.price, item.quantity)
        reduceStock.run(item.quantity, item.id)
      })
      return { orderNumber, total }
    })

    const order = createOrder()
    res.status(201).json({ ...order, status: 'pending', message: 'Order created successfully.' })
  } catch (error) {
    res.status(400).json({ message: error.message || 'Could not create order.' })
  }
})

app.get('/api/orders/:orderNumber', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber)
  if (!order) return res.status(404).json({ message: 'Order not found' })
  const items = db.prepare('SELECT product_id, product_name, price, quantity FROM order_items WHERE order_id = ?').all(order.id)
  res.json({ ...order, items })
})

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist')
app.use(express.static(clientDist))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next())
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: 'Unexpected server error.' })
})

app.listen(PORT, () => console.log(`Veloura API running on http://localhost:${PORT}`))
