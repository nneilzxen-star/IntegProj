import { Cart } from './cart-model.js';
import { Product } from './product.js';

let cart;
try {
  cart = new Cart().load();
} catch (error) {
  console.error('Unable to restore the saved shopping bag.', error);
  cart = new Cart();
}

let state = { products: [], categories: [], cart: cart.items, remoteCartId: cart.remoteCartId };
const listeners = new Set();

cart.addEventListener('cart:updated', () => {
  state = { ...state, cart: cart.items, remoteCartId: cart.remoteCartId };
  publish();
});

function publish() {
  listeners.forEach((listener) => listener(state));
}

/** Subscribe to immutable catalog and cart state snapshots. */
export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Return the current storefront state snapshot. */
export const getState = () => state;

/** Return the encapsulated Cart class instance. */
export const getCartModel = () => cart;

/** Replace products and categories after the API catalog is validated. */
export const setCatalog = ({ products, categories }) => {
  state = { ...state, products: [...products], categories: [...categories] };
  publish();
};

/** Add a validated product model to the persisted cart. */
export const addCartProduct = (product, variant = {}) => {
  const model = product instanceof Product ? product : Product.fromAPI(product);
  if (!model) throw new TypeError('This item cannot be added to the clothing bag.');
  cart.addItem(model, variant);
};

/** Change a product quantity, removing it when quantity reaches zero. */
export const setCartQuantity = (productId, quantity, size, color) => cart.updateQuantity(productId, quantity, size, color);

/** Remove one product from the cart by identifier. */
export const removeCartProduct = (productId, size, color) => cart.removeItem(productId, size, color);

/** Empty the cart and clear its remote cart identifier. */
export const clearCart = () => {
  cart.remoteCartId = null;
  cart.clear();
};

/** Save the FakeStore cart identifier alongside local cart data. */
export const setRemoteCartId = (remoteCartId) => { cart.remoteCartId = remoteCartId; };

/** Return item count, total price, and empty state as one object. */
export const getCartMetrics = () => {
  const { cart: items } = state;
  return {
    itemCount: cart.getItemCount(),
    total: cart.getTotal(),
    isEmpty: items.length === 0
  };
};
