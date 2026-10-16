import { CartItem } from './cart-item.js';
import { Product } from './product.js';

const STORAGE_KEY = 'damitan-ni-ron-store-v1';

/**
 * Encapsulated cart model that saves immutable item snapshots to localStorage.
 */
export class Cart extends EventTarget {
  #items = [];
  #remoteCartId = null;

  /**
   * Create a cart, optionally hydrating saved item data.
   * @param {Array<{ product: object, quantity: number }>} items Initial cart items.
   */
  constructor(items = []) {
    super();
    this.#items = items.map(({ product, quantity, size, color }) => {
      const model = product instanceof Product ? product : Product.fromAPI(product);
      return model ? new CartItem(model, Number(quantity), { size, color }) : null;
    }).filter(Boolean);
  }

  /** Get a copy of cart item references for safe rendering. */
  get items() { return this.#items.map((item) => new CartItem(item.product, item.quantity, item)); }

  /** Get the FakeStore cart identifier associated with this local cart. */
  get remoteCartId() { return this.#remoteCartId; }

  /** Associate a remote cart identifier and persist it. */
  set remoteCartId(value) {
    this.#remoteCartId = Number(value) || null;
    this.save();
  }

  /** Add a product or increase its existing quantity. */
  addItem(product, variant = {}) {
    const isSameVariant = (item) => item.product.id === product.id
      && item.size === (variant.size ?? 'M')
      && item.color === (variant.color ?? 'Black');
    const alreadyPresent = this.#items.some(isSameVariant);
    const current = alreadyPresent ? this.#items.find(isSameVariant) : null;
    this.#items = current
      ? this.#items.map((item) => isSameVariant(item)
        ? new CartItem(item.product, item.quantity + 1, variant)
        : item)
      : [...this.#items, new CartItem(product, 1, variant)];
    this.save();
  }

  /** Remove an item by product identifier. */
  removeItem(productId, size, color) {
    this.#items = this.#items.filter((item) => item.product.id !== Number(productId)
      || (size !== undefined && item.size !== size)
      || (color !== undefined && item.color !== color));
    this.save();
  }

  /** Set quantity or remove the item when the requested quantity is zero. */
  updateQuantity(productId, quantity, size, color) {
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 0) throw new RangeError('Quantity must be a non-negative whole number.');
    const matches = (item) => item.product.id === Number(productId)
      && (size === undefined || item.size === size)
      && (color === undefined || item.color === color);
    this.#items = count === 0
      ? this.#items.filter((item) => !matches(item))
      : this.#items.map((item) => matches(item)
        ? new CartItem(item.product, count, item)
        : item);
    this.save();
  }

  /** Calculate the cart grand total. */
  getTotal() { return this.#items.reduce((total, item) => total + item.getSubtotal(), 0); }

  /** Count all units, including quantities greater than one. */
  getItemCount() { return this.#items.reduce((count, item) => count + item.quantity, 0); }

  /** Remove all cart items and persist the empty cart. */
  clear() {
    this.#items = [];
    this.save();
  }

  /** Save cart items and dispatch the custom cart:updated event. */
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cart: this.#items,
      remoteCartId: this.#remoteCartId
    }));
    this.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: this.items } }));
  }

  /** Restore validated product models from localStorage. */
  load() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return this;
    const parsed = JSON.parse(stored);
    this.#remoteCartId = Number(parsed.remoteCartId) || null;
    this.#items = (Array.isArray(parsed.cart) ? parsed.cart : [])
      .map(({ product, quantity, size, color }) => {
        const model = Product.fromAPI(product);
        return model && Number.isInteger(Number(quantity)) && Number(quantity) > 0
          ? new CartItem(model, Number(quantity), { size, color })
          : null;
      })
      .filter(Boolean);
    return this;
  }
}
