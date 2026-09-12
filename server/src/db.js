import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(path.join(dataDir, 'veloura.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      price INTEGER NOT NULL CHECK(price >= 0),
      description TEXT NOT NULL,
      benefits TEXT NOT NULL,
      image TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      notes TEXT,
      total INTEGER NOT NULL CHECK(total >= 0),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `)

  const count = db.prepare('SELECT COUNT(*) AS count FROM products').get().count
  if (count === 0) seedProducts()
}

function seedProducts() {
  const products = [
    ['Radiance Glow Body Cream','radiance-glow-body-cream','Body Cream',18500,'A rich daily moisturizer that softens dry skin and leaves a luminous, non-greasy finish.','Shea butter • Niacinamide • Vitamin E','/products/01-radiance-glow-body-cream.webp',18,1],
    ['Rose Dew Face Cream','rose-dew-face-cream','Face Cream',14500,'A lightweight face cream for soft, balanced-looking skin with a smooth finish.','Rose water • Squalane • Hyaluronic acid','/products/02-rose-dew-face-cream.webp',24,1],
    ['Cocoa Silk Body Butter','cocoa-silk-body-butter','Body Butter',16800,'Deep nourishment for elbows, knees and very dry areas, with a velvety cocoa scent.','Cocoa butter • Shea butter • Jojoba oil','/products/03-cocoa-silk-body-butter.webp',15,1],
    ['Soft Hands Repair Cream','soft-hands-repair-cream','Hand Cream',8500,'A compact moisture-rich cream for hands exposed to frequent washing and dry weather.','Glycerin • Panthenol • Ceramides','/products/04-soft-hands-repair-cream.webp',30,0],
    ['Even Tone Night Cream','even-tone-night-cream','Face Cream',17200,'A calming night moisturizer designed to support a more even-looking complexion over time.','Niacinamide • Licorice root • Ceramides','/products/05-even-tone-night-cream.webp',20,1],
    ['Vanilla Cloud Body Lotion','vanilla-cloud-body-lotion','Body Cream',12800,'A light everyday lotion with a soft vanilla finish for comfortable, hydrated skin.','Aloe vera • Vitamin E • Sweet almond oil','/products/06-vanilla-cloud-body-lotion.webp',28,0],
    ['Peptide Plump Face Cream','peptide-plump-face-cream','Face Cream',19500,'A cushiony moisturizer that supports a plump, supple look without feeling heavy.','Peptides • Squalane • Hyaluronic acid','/products/07-peptide-plump-face-cream.webp',17,1],
    ['Mango Melt Body Butter','mango-melt-body-butter','Body Butter',15800,'A whipped tropical body butter that melts into dry skin for long-lasting comfort.','Mango butter • Shea butter • Coconut oil','/products/08-mango-melt-body-butter.webp',22,0],
    ['Vitamin C Day Cream','vitamin-c-day-cream','Face Cream',18200,'A brightening daytime moisturizer made for a fresh, rested-looking complexion.','Vitamin C derivative • Vitamin E • Squalane','/products/09-vitamin-c-day-cream.webp',19,1],
    ['Coconut Milk Body Cream','coconut-milk-body-cream','Body Cream',13500,'A creamy everyday hydrator with a soft coconut scent and silky after-feel.','Coconut milk • Glycerin • Shea butter','/products/10-coconut-milk-body-cream.webp',26,0],
    ['Ceramide Barrier Cream','ceramide-barrier-cream','Face Cream',18800,'A comforting moisturizer designed for dry, easily stressed skin and barrier support.','Ceramides • Panthenol • Oat extract','/products/11-ceramide-barrier-cream.webp',16,1],
    ['Lavender Sleep Body Butter','lavender-sleep-body-butter','Body Butter',16500,'A rich nighttime body butter with a soft lavender scent for an indulgent evening routine.','Shea butter • Lavender • Jojoba oil','/products/12-lavender-sleep-body-butter.webp',14,0],
    ['Bright Hands Hand Cream','bright-hands-hand-cream','Hand Cream',9200,'A fast-absorbing hand cream that moisturizes without leaving palms greasy.','Niacinamide • Glycerin • Vitamin E','/products/13-bright-hands-hand-cream.webp',35,0],
    ['Aloe Calm Face Cream','aloe-calm-face-cream','Face Cream',13800,'A lightweight soothing cream for hot days or skin that needs simple hydration.','Aloe vera • Panthenol • Centella','/products/14-aloe-calm-face-cream.webp',25,0],
    ['Shea Satin Body Cream','shea-satin-body-cream','Body Cream',14900,'A silky body cream for everyday moisture with a soft satin finish.','Shea butter • Glycerin • Vitamin E','/products/15-shea-satin-body-cream.webp',21,0],
    ['Golden Hour Glow Cream','golden-hour-glow-cream','Body Cream',17900,'A glow-enhancing body moisturizer that leaves skin looking smooth and radiant.','Niacinamide • Mica • Sweet almond oil','/products/16-golden-hour-glow-cream.webp',18,1],
    ['Honey Oat Comfort Cream','honey-oat-comfort-cream','Face Cream',15400,'A gentle comfort cream for dry skin with a soft, nourishing texture.','Colloidal oat • Honey extract • Ceramides','/products/17-honey-oat-comfort-cream.webp',20,0],
    ['Berry Smooth Body Butter','berry-smooth-body-butter','Body Butter',16200,'A whipped body butter with a subtle berry scent and plush skin feel.','Shea butter • Berry extract • Jojoba oil','/products/18-berry-smooth-body-butter.webp',17,0],
    ['Silk Veil Hand Cream','silk-veil-hand-cream','Hand Cream',8800,'A handbag-friendly hand cream that softens cuticles and dry hands throughout the day.','Glycerin • Squalane • Panthenol','/products/19-silk-veil-hand-cream.webp',32,0],
    ['Midnight Renewal Cream','midnight-renewal-cream','Face Cream',20500,'A richer overnight moisturizer for a smoother, rested-looking complexion by morning.','Bakuchiol • Peptides • Ceramides','/products/20-midnight-renewal-cream.webp',13,1]
  ]
  const insert = db.prepare(`INSERT INTO products (name, slug, category, price, description, benefits, image, stock, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const tx = db.transaction(() => products.forEach((p) => insert.run(...p)))
  tx()
}

export default db
