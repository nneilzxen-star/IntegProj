/**
 * One product reference and its validated quantity in the shopping cart.
 */
export class CartItem {
  /**
   * Create a cart item with a positive integer quantity.
   * @param {import('./product.js').Product} product Product model.
   * @param {number} quantity Item quantity.
   * @param {{ size?: string, color?: string }} variant Selected clothing variant.
   */
  constructor(product, quantity = 1, variant = {}) {
    if (!product || !Number.isFinite(Number(product.id))) throw new TypeError('A valid product is required.');
    this.product = product;
    this.quantity = quantity;
    this.size = variant.size ?? 'M';
    this.color = variant.color ?? 'Black';
  }

  /** Get the number of product units. */
  get quantity() { return this._quantity; }

  /** Set a positive whole-number quantity. */
  set quantity(value) {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1) throw new RangeError('Quantity must be a positive whole number.');
    this._quantity = count;
  }

  /** Calculate this line's subtotal. */
  getSubtotal() { return this.product.price * this.quantity; }

  /** Return a JSON-safe cart item. */
  toJSON() { return { product: this.product, quantity: this.quantity, size: this.size, color: this.color }; }
}
