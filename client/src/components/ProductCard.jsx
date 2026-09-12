import { Plus } from 'lucide-react'

export default function ProductCard({ product, onAdd, onView }) {
  return <article className="product-card">
    <button className="product-image" onClick={() => onView(product)} aria-label={`View ${product.name}`}>
      <img src={product.image} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.src = '/products/placeholder.svg' }} />
      {product.featured ? <span className="tag">Bestseller</span> : null}
    </button>
    <div className="product-copy">
      <p className="product-category">{product.category}</p>
      <button className="product-title" onClick={() => onView(product)}>{product.name}</button>
      <p className="product-description">{product.description}</p>
      <div className="product-footer">
        <strong>₦{product.price.toLocaleString()}</strong>
        <button className="add-button" onClick={() => onAdd(product)} disabled={product.stock < 1}><Plus size={17}/>{product.stock < 1 ? 'Sold out' : 'Add'}</button>
      </div>
    </div>
  </article>
}
