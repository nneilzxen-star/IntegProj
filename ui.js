import { getCartMetrics, getState } from './state.js';
import { filterBy, formatCurrency, handleImageError, slugify, sortBy } from './utils.js';
import {
  COLORS, MEN_SIZE_CHART, SIZES, WOMEN_SIZE_CHART, chunk, getHistoryTotals, getOrderHistory,
  getSalesSummary, renderLabeledMatrixTable, renderMatrixTable
} from './matrix.js';

const createElement = (tagName, className, textContent) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
};

const createProductCard = (product) => {
  const card = createElement('article', 'product-card');
  card.dataset.productId = product.id;
  card.dataset.slug = slugify(product.title);
  card.tabIndex = 0;
  card.setAttribute('aria-label', `View ${product.title}`);
  const imageWrap = createElement('div', 'product-card__image-wrap');
  const image = createElement('img', 'product-card__image');
  image.src = product.image;
  image.alt = product.title;
  image.loading = 'lazy';
  image.width = 420;
  image.height = 520;
  image.addEventListener('error', handleImageError);
  const badge = product.id % 3 === 0 ? createElement('span', 'product-card__badge product-card__badge--new', 'New') : null;
  badge?.setAttribute('aria-label', 'New arrival');
  const wishlist = createElement('button', 'product-card__wishlist');
  wishlist.type = 'button';
  wishlist.dataset.action = 'wishlist';
  wishlist.dataset.productId = product.id;
  const wishlistIds = readWishlistIds();
  const isSaved = wishlistIds.includes(String(product.id));
  wishlist.setAttribute('aria-pressed', String(isSaved));
  wishlist.setAttribute('aria-label', `${isSaved ? 'Remove' : 'Save'} ${product.title} ${isSaved ? 'from' : 'to'} wishlist`);
  wishlist.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 5.1-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.7a4.6 4.6 0 0 1 8.8-1.9 4.6 4.6 0 0 1 8.8 1.9Z"></path></svg>';
  const quickAdd = createElement('button', 'product-card__quick-add', '+');
  quickAdd.type = 'button';
  quickAdd.dataset.action = 'add';
  quickAdd.dataset.productId = product.id;
  quickAdd.setAttribute('aria-label', `Add ${product.title} to bag`);
  quickAdd.textContent = 'Quick add  +';
  imageWrap.append(image);
  if (badge) imageWrap.appendChild(badge);
  imageWrap.append(wishlist, quickAdd);

  const info = createElement('div', 'product-card__info');
  const category = createElement('p', 'product-card__category', product.category);
  const title = createElement('h3', 'product-card__title', product.title);
  const bottom = createElement('div', 'product-card__bottom');
  const price = createElement('span', 'product-card__price', product.formatPrice?.() ?? formatCurrency(product.price));
  const rating = createElement('span', 'product-card__rating');
  const ratingStar = createElement('span', '', '★');
  ratingStar.setAttribute('aria-hidden', 'true');
  rating.append(ratingStar, document.createTextNode(` ${product.rating.rate.toFixed(1)} `));
  rating.appendChild(createElement('span', 'visually-hidden', 'out of 5'));
  bottom.append(price, rating);
  info.append(category, title, bottom);
  card.append(imageWrap, info);
  return card;
};

/** Build product cards dynamically from the current filtered product objects. */
const renderProductsDom = (products, grid, resultCount, layout = 'grid') => {
  const fragment = document.createDocumentFragment();
  const columns = window.innerWidth >= 1920 ? 5 : window.innerWidth >= 1440 ? 4 : 3;
  const productRows = layout === 'rows' ? chunk(products, columns) : [products];
  productRows.forEach((productsInRow) => {
    const row = document.createElement('div');
    row.className = layout === 'rows' ? 'product-grid__row' : 'product-grid__group';
    productsInRow.forEach((product) => row.appendChild(createProductCard(product)));
    fragment.appendChild(row);
  });
  grid.replaceChildren(fragment);
  grid.classList.toggle('product-grid--rows', layout === 'rows');
  grid.setAttribute('aria-busy', 'false');
  resultCount.textContent = `${products.length} ${products.length === 1 ? 'piece' : 'pieces'} to love`;
};

export const renderLoading = (grid) => {
  const skeletons = Array.from({ length: 8 }, () => {
    const card = createElement('div', 'product-card');
    const skeleton = createElement('div', 'skeleton');
    skeleton.setAttribute('aria-hidden', 'true');
    card.appendChild(skeleton);
    return card;
  });
  grid.replaceChildren(...skeletons);
  grid.setAttribute('aria-busy', 'true');
};

export const renderProductState = (panel, { title, message, retry = false }) => {
  panel.replaceChildren();
  const heading = createElement('h3', '', title);
  if (panel.id === 'product-detail-content') heading.id = 'detail-title';
  const description = createElement('p', '', message);
  panel.append(heading, description);
  if (retry) {
    const button = createElement('button', 'button button--dark', 'Try again');
    button.type = 'button';
    button.dataset.action = 'retry';
    panel.appendChild(button);
  }
  panel.hidden = false;
};

export const hideProductState = (panel) => { panel.hidden = true; };

export const renderCategories = (categories, select) => {
  const options = categories.map((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category === "men's clothing" ? 'For him' : 'For her';
    return option;
  });
  select.replaceChildren(new Option('All clothing', 'all'), ...options);
};

const renderCartDom = (cart, drawer, cartItems, emptyMessage, cartFooter, countBadge, totalElement, openButton) => {
  const { itemCount, total, isEmpty } = getCartMetrics();
  const fragment = document.createDocumentFragment();

  cart.forEach(({ product, quantity, size, color }) => {
    const item = createElement('article', 'cart-item');
    item.dataset.productId = product.id;
    item.dataset.size = size;
    item.dataset.color = color;
    const image = createElement('img', 'cart-item__image');
    image.src = product.image;
    image.alt = product.title;
    image.width = 96;
    image.height = 120;
    image.loading = 'lazy';
    image.addEventListener('error', handleImageError);

    const details = createElement('div', 'cart-item__details');
    details.append(
      createElement('p', 'cart-item__category', product.category),
      createElement('h3', 'cart-item__title', product.title),
      createElement('p', 'cart-item__price', `${product.formatPrice?.() ?? formatCurrency(product.price)} · ${size} · ${color}`)
    );
    const quantityControl = createElement('div', 'quantity-control');
    quantityControl.setAttribute('aria-label', `Quantity for ${product.title}`);
    const decrease = createElement('button', '', '−');
    decrease.type = 'button';
    decrease.dataset.action = 'decrease';
    decrease.dataset.size = size;
    decrease.dataset.color = color;
    decrease.setAttribute('aria-label', `Decrease ${product.title} quantity`);
    const quantityText = createElement('span', '', String(quantity));
    const increase = createElement('button', '', '+');
    increase.type = 'button';
    increase.dataset.action = 'increase';
    increase.dataset.size = size;
    increase.dataset.color = color;
    increase.setAttribute('aria-label', `Increase ${product.title} quantity`);
    quantityControl.append(decrease, quantityText, increase);
    details.appendChild(quantityControl);

    const side = createElement('div', 'cart-item__side');
    side.appendChild(createElement('strong', 'cart-item__subtotal', formatCurrency(product.price * quantity)));
    const remove = createElement('button', 'remove-item', 'Remove');
    remove.type = 'button';
    remove.dataset.action = 'remove';
    remove.dataset.size = size;
    remove.dataset.color = color;
    remove.setAttribute('aria-label', `Remove ${product.title} from bag`);
    side.appendChild(remove);
    item.append(image, details, side);
    fragment.appendChild(item);
  });

  cartItems.replaceChildren(fragment);
  emptyMessage.hidden = !isEmpty;
  cartFooter.hidden = isEmpty;
  countBadge.textContent = String(itemCount);
  totalElement.textContent = formatCurrency(total);
  openButton.setAttribute('aria-label', `Open shopping bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`);
  drawer.setAttribute('aria-label', `Shopping bag with ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`);
};

const renderProductDetailsDom = (product, container, stockMatrix) => {
  const layout = createElement('article', 'product-detail');
  layout.dataset.selectedSize = '';
  layout.dataset.selectedColor = '';
  const visual = createElement('div', 'product-detail__visual');
  const image = createElement('img', 'product-detail__image');
  image.src = product.image;
  image.alt = product.title;
  image.width = 640;
  image.height = 720;
  image.addEventListener('error', handleImageError);
  visual.appendChild(image);
  const info = createElement('div', 'product-detail__info');
  info.append(
    createElement('p', 'eyebrow', product.category),
    createElement('h2', '', product.title),
    createElement('p', 'product-detail__rating', `★ ${product.rating.rate.toFixed(1)} · ${product.rating.count} reviews`),
    createElement('p', 'product-detail__description', product.getDescription?.() ?? product.description ?? 'A thoughtful addition to your everyday wardrobe.')
  );
  info.querySelector('h2').id = 'detail-title';
  const price = createElement('p', 'product-detail__price', product.formatPrice?.() ?? formatCurrency(product.price));
  const available = stockMatrix.some((row) => row.some((quantity) => quantity > 0));
  const sizeControls = createElement('div', 'variant-controls');
  sizeControls.setAttribute('aria-label', 'Choose a size');
  sizeControls.appendChild(createElement('p', 'variant-controls__label', 'SIZE'));
  const colorControls = createElement('div', 'variant-controls');
  colorControls.setAttribute('aria-label', 'Choose a color');
  colorControls.appendChild(createElement('p', 'variant-controls__label', 'COLOR'));
  SIZES.forEach((size) => {
    const button = createElement('button', 'variant-button', size);
    button.type = 'button';
    button.dataset.action = 'select-size';
    button.dataset.size = size;
    button.setAttribute('aria-pressed', 'false');
    sizeControls.appendChild(button);
  });
  COLORS.forEach((color) => {
    const button = createElement('button', 'variant-button', color);
    button.type = 'button';
    button.dataset.action = 'select-color';
    button.dataset.color = color;
    button.setAttribute('aria-pressed', 'false');
    colorControls.appendChild(button);
  });
  const stockSection = createElement('section', 'stock-section');
  const stockTitle = createElement('h3', 'stock-section__title', 'Live size and color availability');
  const stockTable = renderLabeledMatrixTable(SIZES, COLORS, stockMatrix, { className: 'data-table stock-table', cornerLabel: 'SIZE / COLOR' });
  stockSection.append(stockTitle, stockTable);
  const guide = createElement('button', 'text-button size-guide-link', 'Size guide');
  guide.type = 'button';
  guide.dataset.action = 'size-guide';
  guide.dataset.gender = product.gender ?? (product.category === "men's clothing" ? 'Men' : 'Women');
  const add = createElement('button', 'button button--dark', 'Add to bag');
  add.type = 'button';
  add.dataset.action = 'add-detail';
  add.dataset.productId = product.id;
  add.disabled = !available;
  add.textContent = available ? 'Add to bag' : 'Sold out';
  const variant = (() => {
    for (let rowIndex = 0; rowIndex < stockMatrix.length; rowIndex += 1) {
      const columnIndex = stockMatrix[rowIndex].findIndex((quantity) => quantity > 0);
      if (columnIndex >= 0) return { size: SIZES[rowIndex], color: COLORS[columnIndex] };
    }
    return null;
  })();
  if (variant) {
    layout.dataset.selectedSize = variant.size;
    layout.dataset.selectedColor = variant.color;
    sizeControls.querySelector(`[data-size="${variant.size}"]`)?.setAttribute('aria-pressed', 'true');
    colorControls.querySelector(`[data-color="${variant.color}"]`)?.setAttribute('aria-pressed', 'true');
    stockTable.querySelector(`[data-size="${variant.size}"][data-color="${variant.color}"]`)?.setAttribute('aria-pressed', 'true');
  }
  info.append(price, sizeControls, colorControls, guide, stockSection, add);
  layout.append(visual, info);
  container.replaceChildren(layout);
};

export const renderCheckoutSummary = (cart, itemsElement, totalElement, shippingFee = 0, shippingLabel = 'Standard · Local') => {
  const fragment = document.createDocumentFragment();
  cart.forEach(({ product, quantity, size, color }) => {
    const row = createElement('div', 'checkout-summary__item');
    row.append(
      createElement('span', '', `${product.title} · ${size}/${color} × ${quantity}`),
      createElement('strong', '', formatCurrency(product.price * quantity))
    );
    fragment.appendChild(row);
  });
  const shippingRow = createElement('div', 'checkout-summary__item');
  shippingRow.append(
    createElement('span', '', `Shipping · ${shippingLabel}`),
    createElement('strong', '', formatCurrency(shippingFee))
  );
  fragment.appendChild(shippingRow);
  itemsElement.replaceChildren(fragment);
  totalElement.textContent = formatCurrency(getCartMetrics().total + shippingFee);
};

export const renderConfirmation = (order, content) => {
  content.replaceChildren();
  const mark = createElement('div', 'confirmation-mark', '✓');
  mark.setAttribute('aria-hidden', 'true');
  const eyebrow = createElement('p', 'eyebrow', 'ORDER CONFIRMED');
  const title = createElement('h2', '', 'It’s a good fit.');
  title.id = 'confirmation-title';
  const greeting = createElement('p', '', `Thank you, ${order.customer.name}. Your new favorites are on their way.`);
  const orderNumber = createElement('p', '', `Order #${order.id}`);
  const items = createElement('div', 'confirmation-items');
  order.items.forEach(({ product, quantity, size, color }) => {
    const row = createElement('div', 'confirmation-item');
    row.append(
      createElement('span', '', `${product.title} · ${size}/${color} × ${quantity}`),
      createElement('strong', '', formatCurrency(product.price * quantity))
    );
    items.appendChild(row);
  });
  const shippingRow = createElement('div', 'confirmation-item');
  shippingRow.append(
    createElement('span', '', `Shipping · ${order.customer.shipping} · ${order.customer.region}`),
    createElement('strong', '', formatCurrency(Number(order.customer.shippingFee) || 0))
  );
  items.appendChild(shippingRow);
  const total = createElement('div', 'confirmation-total');
  total.append(createElement('span', '', 'Order total'), createElement('strong', '', formatCurrency(order.total)));
  total.className = 'cart-total confirmation-total';
  const actions = createElement('div', 'confirmation-actions');
  const shop = createElement('button', 'button button--dark', 'Back to the collection');
  shop.type = 'button';
  shop.dataset.action = 'dismiss-confirmation';
  const cancel = createElement('button', 'text-button', 'Cancel this order');
  cancel.type = 'button';
  cancel.dataset.action = 'cancel-order';
  cancel.dataset.orderId = order.id;
  actions.append(shop, cancel);
  content.append(mark, eyebrow, title, greeting, orderNumber, items, total, actions);
  if (order.cleanupError) content.insertBefore(createElement('p', '', order.cleanupError), actions);
};

/** Render saved 3D order history and category sales statistics. */
export function renderOrderHistory(container) {
  container.replaceChildren();
  const { orders, metadata } = getOrderHistory();
  const totals = getHistoryTotals();
  const title = createElement('h2', '', 'Your order history');
  title.id = 'history-title';
  const summary = createElement('p', 'history-summary', `${totals.orderCount} orders · ${totals.units} units purchased`);
  const salesHeading = createElement('h3', '', 'Sales summary');
  const salesMatrix = getSalesSummary().map(([category, units, revenue], rowIndex) => (
    rowIndex === 0 ? [category, units, revenue] : [category, units, formatCurrency(revenue)]
  ));
  const salesTable = renderMatrixTable(salesMatrix, { className: 'data-table' });
  const ordersHeading = createElement('h3', '', 'Past orders');
  const orderList = createElement('div', 'history-orders');
  if (orders.length === 0) {
    orderList.appendChild(createElement('p', '', 'No completed orders have been saved in this browser yet.'));
  } else {
    orders.forEach((orderRows, orderIndex) => {
      const section = createElement('section', 'history-order');
      const orderMeta = metadata[orderIndex] ?? {};
      section.appendChild(createElement('h4', '', `Order ${orderMeta.id ?? orderIndex + 1} · ${orderMeta.createdAt ? new Date(orderMeta.createdAt).toLocaleDateString() : 'Date unavailable'}`));
      const table = document.createElement('table');
      table.className = 'data-table';
      const head = document.createElement('thead');
      const header = document.createElement('tr');
      ['Product', 'Size', 'Color', 'Qty', 'Unit price', 'Subtotal'].forEach((label) => {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = label;
        header.appendChild(cell);
      });
      head.appendChild(header);
      const body = document.createElement('tbody');
      const orderSubtotal = orderRows.reduce((sum, row) => sum + (Number(row[4]) || 0) * (Number(row[5]) || 0), 0);
      orderRows.forEach(([productId, name, size, color, quantity, price]) => {
        const row = document.createElement('tr');
        const subtotal = Number(quantity) * Number(price);
        [name ?? `Product ${productId}`, size, color, quantity, formatCurrency(price), formatCurrency(subtotal)].forEach((value, index) => {
          const cell = document.createElement(index === 0 ? 'th' : 'td');
          if (index === 0) cell.scope = 'row';
          cell.textContent = String(value ?? '');
          row.appendChild(cell);
        });
        body.appendChild(row);
      });
      table.append(head, body);
      section.appendChild(table);
      section.appendChild(createElement('p', 'history-order__total', `Products ${formatCurrency(orderSubtotal)} · Shipping ${formatCurrency(orderMeta.shippingFee ?? 0)} · Total ${formatCurrency(orderMeta.total ?? orderSubtotal)}`));
      orderList.appendChild(section);
    });
  }
  container.append(title, summary, salesHeading, salesTable, ordersHeading, orderList);
}

export const showToast = (message, region, isError = false) => {
  const toast = createElement('div', `toast${isError ? ' toast--error' : ''}`, message);
  toast.setAttribute('role', isError ? 'alert' : 'status');
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3400);
};

export const getVisibleProducts = (products, filters) => {
  const { search, category, minPrice, maxPrice, sort } = filters;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const matches = filterBy(({ title, category: productCategory, price }) => (
    (!normalizedSearch || title.toLocaleLowerCase().includes(normalizedSearch))
    && (category === 'all' || productCategory === category)
    && price >= minPrice
    && price <= maxPrice
  ))(products);

  const sorters = {
    ['price-asc']: sortBy('price'),
    ['price-desc']: sortBy('price', 'desc'),
    ['name-asc']: sortBy('title'),
    rating: sortBy((product) => product.rating.rate, 'desc')
  };
  return (sorters[sort] ?? ((items) => items))(matches);
};

export const getProduct = (id) => getState().products.find((product) => product.id === Number(id));

/** Read saved wishlist identifiers without allowing corrupt storage to break rendering. */
export const readWishlistIds = () => {
  try {
    const ids = JSON.parse(localStorage.getItem('damitan-ni-ron-wishlist') ?? '[]');
    return Array.isArray(ids) ? ids.map(String) : [];
  } catch (error) {
    console.error('Unable to read saved wishlist items.', error);
    return [];
  }
};

/**
 * DOM renderer responsible for product card and detail view construction.
 */
export class ProductRenderer {
  /** Render product cards from model instances. */
  renderProducts(products, grid, resultCount, layout = 'grid') { renderProductsDom(products, grid, resultCount, layout); }

  /** Render an individual product details view. */
  renderDetails(product, container, stockMatrix) { renderProductDetailsDom(product, container, stockMatrix); }

  /** Render a generic two-dimensional data table. */
  renderMatrix(matrix, container, options = {}) { container.replaceChildren(renderMatrixTable(matrix, options)); }
}

/**
 * DOM renderer responsible for cart contents, badge, and totals.
 */
export class CartRenderer {
  /** Render cart rows and the item-count badge. */
  render(cart, ...elements) { renderCartDom(cart, ...elements); }
}

/**
 * DOM renderer for multidimensional order history and sales summary data.
 */
export class OrderHistoryRenderer {
  /** Render a nested order list and derived sales summary into a container. */
  render(container) { renderOrderHistory(container); }
}

const productRenderer = new ProductRenderer();
const cartRenderer = new CartRenderer();
const orderHistoryRenderer = new OrderHistoryRenderer();

/** Render products through the dedicated renderer class. */
export const renderProducts = (...args) => productRenderer.renderProducts(...args);
/** Render cart contents through the dedicated renderer class. */
export const renderCart = (cart, ...elements) => cartRenderer.render(cart, ...elements);
/** Render a product detail panel through the dedicated renderer class. */
export const renderProductDetails = (product, container, stockMatrix) => productRenderer.renderDetails(product, container, stockMatrix);
/** Render the order history through its dedicated renderer class. */
export const renderHistory = (container) => orderHistoryRenderer.render(container);
/** Render generic matrix tables through the product UI renderer's table method. */
export const renderDataMatrix = (matrix, container, options = {}) => productRenderer.renderMatrix(matrix, container, options);
/** Render a size chart matrix into a dialog container. */
export const renderSizeChart = (matrix, container, title) => {
  const heading = createElement('h2', '', title);
  heading.id = 'size-guide-title';
  container.replaceChildren(heading, renderMatrixTable(matrix, { className: 'data-table size-chart-table' }));
};
