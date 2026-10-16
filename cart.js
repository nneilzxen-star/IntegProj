import { createRemoteCart, deleteRemoteCart, updateRemoteCart } from './api.js';
import { clearCart, getCartModel, getState } from './state.js';
import { Order } from './order.js';
import { Product } from './product.js';
import { simulatePaymentProcessing } from './utils.js';
import { getShippingFee } from './matrix.js';

let syncQueue = Promise.resolve();

const toApiProducts = (cart) => cart.map(({ product, quantity, size, color }) => ({
  productId: product.id, quantity, size, color
}));

/** Serialize cart writes so rapid quantity clicks cannot persist stale snapshots. */
export const syncCartWithApi = () => {
  syncQueue = syncQueue.catch(() => {}).then(async () => {
    const { cart } = getState();
    const cartModel = getCartModel();
    const { remoteCartId } = getState();
    if (cart.length === 0) {
      if (remoteCartId) await deleteRemoteCart(remoteCartId);
      cartModel.remoteCartId = null;
      return;
    }

    const products = toApiProducts(cart);
    if (remoteCartId) {
      await updateRemoteCart(remoteCartId, products);
    } else {
      const remoteCart = await createRemoteCart(products);
      if (remoteCart?.id) cartModel.remoteCartId = remoteCart.id;
    }
  });

  return syncQueue;
};

/** Submit the current bag to the API as the demo checkout order. */
export const submitOrder = async (customer) => {
  await syncQueue.catch(() => {});
  const { cart, remoteCartId } = getState();
  if (cart.length === 0) throw new Error('Your bag is empty.');

  const orderProducts = toApiProducts(cart);
  const remoteOrder = await createRemoteCart(orderProducts);
  await simulatePaymentProcessing();
  const orderSnapshot = new Order({
    id: remoteOrder?.id ?? `DNR-${Date.now()}`,
    customer,
    items: cart.map(({ product, quantity, size, color }) => ({
      product: Product.fromAPI(product.toJSON()),
      quantity,
      size,
      color
    })),
    total: cart.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0)
      + getShippingFee(customer.region, customer.shipping)
  }).toJSON();

  const cleanupErrors = [];
  for (const cartId of [remoteOrder?.id, remoteCartId].filter((id, index, ids) => id && ids.indexOf(id) === index)) {
    try {
      await deleteRemoteCart(cartId);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  clearCart();
  if (cleanupErrors.length > 0) orderSnapshot.cleanupError = 'The order was placed, but the demo cart could not be fully cleared.';

  return orderSnapshot;
};

/** Cancel the local order and best-effort remove its API cart representation. */
export const cancelOrder = async (orderId) => {
  await deleteRemoteCart(orderId);
};
