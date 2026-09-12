import { useEffect, useMemo, useState } from 'react'
import {
  Boxes, ChevronRight, CircleDollarSign, ClipboardList, ExternalLink, Home,
  LogOut, Package, Pencil, Plus, Search, ShoppingBag, Trash2, TriangleAlert,
  Users, X
} from 'lucide-react'
import './admin.css'

const money = (value) => `₦${Number(value || 0).toLocaleString()}`
const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
const categories = ['Face Cream', 'Body Cream', 'Body Butter', 'Hand Cream']

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.message || 'Something went wrong.')
    error.status = response.status
    throw error
  }
  return body
}

function Login({ onLogin }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify(data) })
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return <div className="admin-login">
    <div className="admin-login-panel">
      <a className="admin-brand" href="/">VELOURA <small>ADMIN</small></a>
      <div>
        <p className="admin-eyebrow">Store management</p>
        <h1>Welcome back.</h1>
        <p className="admin-muted">Sign in to manage products, stock and customer orders.</p>
      </div>
      <form onSubmit={submit} className="admin-login-form">
        <label>Email<input required type="email" name="email" autoComplete="username" /></label>
        <label>Password<input required type="password" name="password" autoComplete="current-password" /></label>
        {error && <p className="admin-error">{error}</p>}
        <button className="admin-primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <a href="/" className="admin-back">← Back to storefront</a>
    </div>
    <div className="admin-login-art">
      <span>VELOURA</span>
      <strong>Pure care.<br/>Real results.</strong>
      <p>Manage every product and order in one calm workspace.</p>
    </div>
  </div>
}

function Sidebar({ section, setSection, email, onLogout }) {
  const items = [
    ['dashboard', Home, 'Dashboard'],
    ['products', Package, 'Products'],
    ['orders', ShoppingBag, 'Orders'],
    ['inventory', Boxes, 'Inventory'],
  ]
  return <aside className="admin-sidebar">
    <a href="/admin" className="admin-brand sidebar-brand">VELOURA <small>ADMIN</small></a>
    <nav>{items.map(([key, Icon, label]) => <button key={key} onClick={() => setSection(key)} className={section === key ? 'active' : ''}><Icon size={19}/><span>{label}</span></button>)}</nav>
    <div className="admin-sidebar-bottom">
      <a href="/" target="_blank">View storefront <ExternalLink size={15}/></a>
      <div className="admin-user"><div className="admin-avatar">A</div><div><strong>Admin</strong><span>{email}</span></div></div>
      <button className="admin-logout" onClick={onLogout}><LogOut size={17}/> Sign out</button>
    </div>
  </aside>
}

function StatCard({ icon: Icon, label, value, hint }) {
  return <article className="admin-stat"><div className="admin-stat-icon"><Icon size={22}/></div><div><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div></article>
}

function StatusBadge({ status }) {
  return <span className={`admin-status status-${status}`}>{status}</span>
}

function Dashboard({ data, setSection }) {
  if (!data) return <Loading />
  return <>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">Overview</p><h1>Store dashboard</h1><p>Here’s what’s happening with Veloura right now.</p></div><button className="admin-secondary" onClick={() => setSection('products')}><Plus size={17}/> Add product</button></div>
    <div className="admin-stats">
      <StatCard icon={ClipboardList} label="Total orders" value={Number(data.orders.total_orders || 0).toLocaleString()} hint={`${data.orders.pending || 0} pending`} />
      <StatCard icon={CircleDollarSign} label="Revenue" value={money(data.orders.revenue)} hint="All recorded orders" />
      <StatCard icon={Users} label="Customers" value={Number(data.orders.customers || 0).toLocaleString()} hint="Unique customer emails" />
      <StatCard icon={Package} label="Products" value={Number(data.products.total_products || 0).toLocaleString()} hint={`${data.products.total_units || 0} units in stock`} />
    </div>
    <div className="admin-dashboard-grid">
      <section className="admin-panel admin-panel-wide">
        <div className="admin-panel-head"><div><h2>Recent orders</h2><p>Latest purchases placed through the store.</p></div><button onClick={() => setSection('orders')}>View all <ChevronRight size={15}/></button></div>
        <div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>{data.recentOrders.length ? data.recentOrders.map(order => <tr key={order.id}><td><b>#{order.order_number}</b></td><td>{order.customer_name}</td><td>{money(order.total)}</td><td><StatusBadge status={order.status}/></td><td>{new Date(order.created_at).toLocaleDateString()}</td></tr>) : <tr><td colSpan="5" className="admin-empty-cell">No orders yet.</td></tr>}</tbody></table></div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Low stock</h2><p>Products at 5 units or below.</p></div><button onClick={() => setSection('inventory')}>View inventory</button></div>
        <div className="low-stock-list">{data.lowStock.length ? data.lowStock.map(product => <div key={product.id}><img src={product.image} onError={e => e.currentTarget.src='/products/placeholder.svg'} alt=""/><span><strong>{product.name}</strong><small>{product.category}</small></span><b>{product.stock}</b></div>) : <div className="admin-success-empty">✓ Stock levels look healthy.</div>}</div>
      </section>
    </div>
  </>
}

function ProductModal({ product, onClose, onSaved }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const editing = Boolean(product?.id)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const raw = Object.fromEntries(new FormData(e.currentTarget))
    const payload = { ...raw, price: Number(raw.price), stock: Number(raw.stock), featured: raw.featured === 'on' }
    try {
      await api(editing ? `/api/admin/products/${product.id}` : '/api/admin/products', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="admin-modal-backdrop" onMouseDown={onClose}><div className="admin-modal" onMouseDown={e => e.stopPropagation()}>
    <div className="admin-modal-head"><div><p className="admin-eyebrow">{editing ? 'Edit product' : 'New product'}</p><h2>{editing ? product.name : 'Add a product'}</h2></div><button onClick={onClose}><X/></button></div>
    <form onSubmit={submit} className="admin-product-form">
      <div className="admin-form-grid"><label>Product name<input required name="name" defaultValue={product?.name || ''}/></label><label>Category<select required name="category" defaultValue={product?.category || 'Face Cream'}>{categories.map(c => <option key={c}>{c}</option>)}</select></label></div>
      <div className="admin-form-grid"><label>Price (₦)<input required min="0" type="number" name="price" defaultValue={product?.price || ''}/></label><label>Stock<input required min="0" type="number" name="stock" defaultValue={product?.stock ?? 0}/></label></div>
      <label>Description<textarea required name="description" rows="3" defaultValue={product?.description || ''}/></label>
      <label>Key ingredients / benefits<textarea required name="benefits" rows="2" defaultValue={product?.benefits || ''}/></label>
      <label>Product image URL<input name="image" defaultValue={product?.image || '/products/placeholder.svg'} placeholder="/products/product.webp or https://..."/></label>
      <label className="admin-check"><input type="checkbox" name="featured" defaultChecked={Boolean(Number(product?.featured || 0))}/><span>Feature this product as a bestseller</span></label>
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={onClose}>Cancel</button><button className="admin-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create product'}</button></div>
    </form>
  </div></div>
}

function Products({ inventoryOnly = false }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try { setProducts(await api('/api/admin/products')) } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase())).filter(p => !inventoryOnly || Number(p.stock) <= 10), [products, search, inventoryOnly])

  async function remove(product) {
    if (!confirm(`Delete ${product.name}?`)) return
    try { await api(`/api/admin/products/${product.id}`, { method: 'DELETE' }); load() } catch (err) { alert(err.message) }
  }

  return <>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">{inventoryOnly ? 'Inventory' : 'Catalog'}</p><h1>{inventoryOnly ? 'Stock management' : 'Products'}</h1><p>{inventoryOnly ? 'Focus on low and medium stock levels.' : 'Create and manage every product in the storefront.'}</p></div>{!inventoryOnly && <button className="admin-primary" onClick={() => setModal({})}><Plus size={17}/> Add product</button>}</div>
    <div className="admin-toolbar"><div className="admin-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products..."/></div><span>{filtered.length} product{filtered.length === 1 ? '' : 's'}</span></div>
    {error && <p className="admin-error">{error}</p>}
    <section className="admin-panel admin-list-panel">{loading ? <Loading/> : <div className="admin-table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Featured</th><th></th></tr></thead><tbody>{filtered.map(product => <tr key={product.id}><td><div className="admin-product-cell"><img src={product.image} onError={e => e.currentTarget.src='/products/placeholder.svg'} alt=""/><span><strong>{product.name}</strong><small>{product.slug}</small></span></div></td><td>{product.category}</td><td>{money(product.price)}</td><td><span className={Number(product.stock) <= 5 ? 'stock-low' : Number(product.stock) <= 10 ? 'stock-mid' : 'stock-ok'}>{product.stock} units</span></td><td>{Number(product.featured) ? 'Yes' : '—'}</td><td><div className="admin-row-actions"><button title="Edit" onClick={()=>setModal(product)}><Pencil size={16}/></button>{!inventoryOnly && <button className="danger" title="Delete" onClick={()=>remove(product)}><Trash2 size={16}/></button>}</div></td></tr>)}</tbody></table></div>}</section>
    {modal && <ProductModal product={modal} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load()}}/>}
  </>
}

function OrderDrawer({ id, onClose, onChanged }) {
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api(`/api/admin/orders/${id}`).then(setOrder).catch(e=>setError(e.message)) }, [id])
  async function changeStatus(status) {
    try { const updated = await api(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setOrder(prev=>({...prev,...updated})); onChanged() } catch (err) { setError(err.message) }
  }
  return <div className="admin-drawer-backdrop" onMouseDown={onClose}><aside className="admin-order-drawer" onMouseDown={e=>e.stopPropagation()}><div className="admin-modal-head"><div><p className="admin-eyebrow">Order details</p><h2>{order ? `#${order.order_number}` : 'Loading…'}</h2></div><button onClick={onClose}><X/></button></div>{error && <p className="admin-error">{error}</p>}{order && <div className="admin-order-body"><div className="admin-order-summary"><div><span>Customer</span><strong>{order.customer_name}</strong><small>{order.email}<br/>{order.phone}</small></div><div><span>Delivery</span><strong>{order.city}</strong><small>{order.address}</small></div></div><label className="admin-status-select">Order status<select value={order.status} onChange={e=>changeStatus(e.target.value)}>{statuses.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select></label><h3>Items</h3><div className="admin-order-items">{order.items.map(item=><div key={item.id}><span><strong>{item.product_name}</strong><small>{item.quantity} × {money(item.price)}</small></span><b>{money(Number(item.price)*Number(item.quantity))}</b></div>)}</div><div className="admin-order-total"><span>Total</span><strong>{money(order.total)}</strong></div>{order.notes && <div className="admin-note"><strong>Order note</strong><p>{order.notes}</p></div>}<small className="admin-muted">Placed {new Date(order.created_at).toLocaleString()}</small></div>}</aside></div>
}

function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  async function load() {
    setLoading(true); setError('')
    try { setOrders(await api('/api/admin/orders')) } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  useEffect(()=>{load()},[])
  const filtered = useMemo(()=>orders.filter(o=>`${o.order_number} ${o.customer_name} ${o.email} ${o.phone}`.toLowerCase().includes(search.toLowerCase())).filter(o=>filter==='All'||o.status===filter),[orders,search,filter])
  return <>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">Orders</p><h1>Customer orders</h1><p>Track, review and update every order from checkout to delivery.</p></div></div>
    <div className="admin-toolbar orders-toolbar"><div className="admin-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order, customer, email..."/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{statuses.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select></div>
    {error && <p className="admin-error">{error}</p>}
    <section className="admin-panel admin-list-panel">{loading?<Loading/>:<div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Contact</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>{filtered.length?filtered.map(o=><tr key={o.id}><td><b>#{o.order_number}</b></td><td>{o.customer_name}</td><td><small>{o.email}<br/>{o.phone}</small></td><td>{money(o.total)}</td><td><StatusBadge status={o.status}/></td><td>{new Date(o.created_at).toLocaleDateString()}</td><td><button className="admin-view-button" onClick={()=>setSelected(o.id)}>View <ChevronRight size={15}/></button></td></tr>):<tr><td colSpan="7" className="admin-empty-cell">No orders match this view.</td></tr>}</tbody></table></div>}</section>
    {selected && <OrderDrawer id={selected} onClose={()=>setSelected(null)} onChanged={load}/>} 
  </>
}

function Loading() { return <div className="admin-loading"><span></span><p>Loading…</p></div> }

export default function AdminApp() {
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState(null)
  const [section, setSection] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  async function checkAuth() {
    setChecking(true)
    try { const me = await api('/api/admin/me'); setUser(me) } catch { setUser(null) } finally { setChecking(false) }
  }
  useEffect(()=>{checkAuth()},[])
  useEffect(()=>{ if(user && section==='dashboard') api('/api/admin/dashboard').then(setDashboard).catch(e=>setError(e.message)) },[user,section])

  async function logout() { await api('/api/admin/logout',{method:'POST'}).catch(()=>{}); setUser(null) }
  if (checking) return <div className="admin-splash">VELOURA <span>ADMIN</span></div>
  if (!user) return <Login onLogin={checkAuth}/>

  let content = <Dashboard data={dashboard} setSection={setSection}/>
  if (section === 'products') content = <Products/>
  if (section === 'inventory') content = <Products inventoryOnly/>
  if (section === 'orders') content = <Orders/>

  return <div className="admin-shell"><Sidebar section={section} setSection={setSection} email={user.email} onLogout={logout}/><main className="admin-main">{error && <p className="admin-error">{error}</p>}{content}</main></div>
}
