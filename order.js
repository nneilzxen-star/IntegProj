import { CartItem } from './cart-item.js';
import { Product } from './product.js';

/**
 * Checkout order snapshot with customer, item, total, and status data.
 */
export class Order {
  /**
   * Create an order from validated checkout details and cart items.
   * @param {{ id?: number|string, customer: object, items: import('./cart-item.js').CartItem[], total?: number, status?: string, createdAt?: string }} data Order values.
   */
  constructor({ id = `DNR-${Date.now()}`, customer, items, total, status = 'confirmed', createdAt = new Date().toISOString() }) {
    this.id = id;
    this.customer = { ...customer };
    this.items = items.map(({ product, quantity, size, color }) => new CartItem(
      Product.fromAPI(product.toJSON?.() ?? product),
      quantity,
      { size, color }
    ));
    this.total = Number.isFinite(Number(total))
      ? Number(total)
      : this.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    this.status = status;
    this.createdAt = createdAt;
  }

  /** Serialize the order into a JSON-safe snapshot. */
  toJSON() {
    return {
      id: this.id,
      customer: Object.fromEntries(Object.entries(this.customer)),
      items: this.items.map(({ product, quantity, size, color }) => ({ product: product.toJSON(), quantity, size, color })),
      total: this.total,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}
