import { useEffect, useMemo, useState } from 'react'
import { Menu, Search, ShoppingBag, X, Minus, Plus, ArrowRight, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import ProductCard from './components/ProductCard.jsx'

const categories = ['All', 'Face Cream', 'Body Cream', 'Body Butter', 'Hand Cream']
const money = (value) => `₦${Number(value).toLocaleString()}`

export default function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('veloura-cart') || '[]'))
  const [cartOpen, setCartOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [checkout, setCheckout] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { fetch('/api/products').then(r => r.json()).then(setProducts).catch(() => setError('Could not load products.')).finally(() => setLoading(false)) }, [])
  useEffect(() => { localStorage.setItem('veloura-cart', JSON.stringify(cart)) }, [cart])

  const filtered = useMemo(() => products.filter(p => (category === 'All' || p.category === category) && (`${p.name} ${p.description}`).toLowerCase().includes(search.toLowerCase())), [products, category, search])
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const add = (product) => {
    setCart(prev => {
      const found = prev.find(i => i.id === product.id)
      if (found) return prev.map(i => i.id === product.id ? { ...i, quantity: Math.min(i.quantity + 1, product.stock) } : i)
      return [...prev, { ...product, quantity: 1 }]
    })
    setCartOpen(true)
  }
  const qty = (id, delta) => setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, Math.min(i.quantity + delta, i.stock)) } : i).filter(i => i.quantity > 0))

  async function submitOrder(e) {
    e.preventDefault(); setError('')
    const data = Object.fromEntries(new FormData(e.currentTarget))
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: data.customerName, email: data.email, phone: data.phone, address: data.address, city: data.city, notes: data.notes, items: cart.map(({id, quantity}) => ({id, quantity})) }) })
    const result = await response.json()
    if (!response.ok) return setError(result.message || 'Could not create order.')
    setOrder(result); setCart([]); setCheckout(false); setCartOpen(false)
  }

  return <div>
    <div className="announcement">Free delivery in Lagos on orders over ₦50,000</div>
    <header className="header shell">
      <button className="icon-button mobile-only" onClick={() => setMobileNav(!mobileNav)}><Menu/></button>
      <a className="brand" href="#top">VELOURA</a>
      <nav className={mobileNav ? 'nav nav-open' : 'nav'}>
        <a href="#shop" onClick={() => setMobileNav(false)}>Shop</a><a href="#story" onClick={() => setMobileNav(false)}>Our Story</a><a href="#care" onClick={() => setMobileNav(false)}>Skin Care</a>
      </nav>
      <button className="cart-trigger" onClick={() => setCartOpen(true)}><ShoppingBag size={20}/><span>Bag</span><b>{count}</b></button>
    </header>

    <main id="top">
      <section className="hero shell">
        <div className="hero-copy">
          <h1>Soft skin.<br/><em>Quiet confidence.</em></h1>
          <p>Thoughtfully selected creams and moisturizers for women who want simple, beautiful everyday skincare.</p>
          <a className="primary" href="#shop">Shop the collection <ArrowRight size={18}/></a>
          <div className="hero-notes"><span><Sparkles size={17}/> Moisture-first formulas</span><span><ShieldCheck size={17}/> Carefully curated</span></div>
        </div>
        <div className="hero-media"><img src="https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1200&q=85" alt="Woman applying skincare cream"/><div className="hero-card"><span>Daily ritual</span><strong>Glow, without the fuss.</strong></div></div>
      </section>

      <section className="benefit-strip" id="care"><div className="shell benefits"><div><Truck/><span><strong>Fast delivery</strong>Across Nigeria</span></div><div><Sparkles/><span><strong>Everyday care</strong>Simple routines</span></div><div><ShieldCheck/><span><strong>Secure checkout</strong>Your details stay protected</span></div></div></section>

      <section id="shop" className="shop shell">
        <div className="section-heading"><div><p className="section-label">The collection</p><h2>Find your everyday favourite.</h2></div><div className="search-box"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search creams..."/></div></div>
        <div className="categories">{categories.map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div>
        {loading ? <p className="empty">Loading products…</p> : filtered.length ? <div className="products">{filtered.map(product => <ProductCard key={product.id} product={product} onAdd={add} onView={setSelected}/>)}</div> : <p className="empty">No products match your search.</p>}
      </section>

      <section className="story shell" id="story"><div className="story-image"><img src="https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=1000&q=85" alt="Skincare products arranged on a vanity"/></div><div className="story-copy"><p className="section-label">Veloura</p><h2>Skincare should feel like care, not homework.</h2><p>We keep the routine simple: rich textures, useful ingredients and products that feel beautiful on your shelf and comfortable on your skin.</p><a href="#shop">Explore all products <ArrowRight size={17}/></a></div></section>
    </main>

    <footer><div className="shell footer"><div><a className="brand inverse" href="#top">VELOURA</a><p>Everyday skincare for soft, nourished skin.</p></div><div><strong>Shop</strong><a href="#shop">All products</a><a href="#care">Why Veloura</a></div><div><strong>Contact</strong><span>Lagos, Nigeria</span><span>hello@veloura.store</span></div></div><div className="shell copyright">© 2026 Veloura. Demo storefront.</div></footer>

    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="product-modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setSelected(null)}><X/></button><img src={selected.image} alt={selected.name} onError={(event) => { event.currentTarget.src = '/products/placeholder.svg' }}/><div><p className="product-category">{selected.category}</p><h2>{selected.name}</h2><p>{selected.description}</p><p className="benefits-text">{selected.benefits}</p><strong className="modal-price">{money(selected.price)}</strong><button className="primary wide" onClick={() => { add(selected); setSelected(null) }}>Add to bag</button></div></div></div>}

    <aside className={cartOpen ? 'drawer drawer-open' : 'drawer'}><div className="drawer-head"><h2>Your bag <span>{count}</span></h2><button className="icon-button" onClick={() => { setCartOpen(false); setCheckout(false) }}><X/></button></div>{!checkout ? <>{cart.length === 0 ? <div className="empty-cart"><ShoppingBag size={38}/><h3>Your bag is empty</h3><p>Add a little self-care.</p></div> : <><div className="cart-items">{cart.map(item => <div className="cart-row" key={item.id}><img src={item.image} alt="" onError={(event) => { event.currentTarget.src = '/products/placeholder.svg' }}/><div><strong>{item.name}</strong><span>{money(item.price)}</span><div className="quantity"><button onClick={() => qty(item.id,-1)}><Minus size={14}/></button><span>{item.quantity}</span><button onClick={() => qty(item.id,1)}><Plus size={14}/></button></div></div><b>{money(item.price * item.quantity)}</b></div>)}</div><div className="cart-summary"><div><span>Subtotal</span><strong>{money(total)}</strong></div><p>Delivery fee is confirmed after your address is reviewed.</p><button className="primary wide" onClick={() => setCheckout(true)}>Continue to checkout</button></div></>}</> : <form className="checkout" onSubmit={submitOrder}><button type="button" className="back-link" onClick={() => setCheckout(false)}>← Back to bag</button><h3>Delivery details</h3><label>Full name<input required name="customerName"/></label><label>Email<input required type="email" name="email"/></label><label>Phone<input required name="phone" placeholder="080…"/></label><label>Delivery address<textarea required name="address" rows="3"/></label><label>City / State<input required name="city"/></label><label>Order notes <small>(optional)</small><textarea name="notes" rows="2"/></label>{error && <p className="form-error">{error}</p>}<button className="primary wide" type="submit">Place order · {money(total)}</button></form>}</aside>
    {cartOpen && <button className="drawer-overlay" onClick={() => setCartOpen(false)} aria-label="Close cart"/>}

    {order && <div className="modal-backdrop"><div className="success-modal"><div className="success-icon">✓</div><h2>Order received</h2><p>Thank you. Your order number is <strong>{order.orderNumber}</strong>.</p><p>Total: <strong>{money(order.total)}</strong></p><button className="primary wide" onClick={() => setOrder(null)}>Continue shopping</button></div></div>}
  </div>
}
