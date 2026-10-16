/** Format a numeric amount as a USD currency string. */
export const formatCurrency = function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
  }).format(Number.isFinite(Number(amount)) ? Number(amount) : 0);
};

/** Debounce rapid input events while preserving the latest arguments. */
export const debounce = (callback, delay = 250) => {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
};

/** Convert API product data into the product shape used by the storefront. */
export const normalizeProduct = (rawProduct) => {
  if (!rawProduct || !Number.isFinite(Number(rawProduct.id)) || !Number.isFinite(Number(rawProduct.price))) return null;
  const { id, title, price, category, image, rating = {} } = rawProduct;
  const normalizedRating = { rate: Number(rating?.rate) || 0, count: Number(rating?.count) || 0 };
  if (!Object.values(normalizedRating).every(Number.isFinite)) return null;
  return {
    id: Number(id),
    title: String(title ?? '').trim() || 'Untitled piece',
    price: Number(price),
    category: String(category ?? '').trim(),
    image: typeof image === 'string' && image.trim() ? image : './assets/product-placeholder.svg',
    rating: normalizedRating,
    description: String(rawProduct.description ?? '').trim()
  };
};

/** Return a safe local image if a product image URL fails to load. */
export const handleImageError = (event) => {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied !== 'true') {
    image.dataset.fallbackApplied = 'true';
    image.src = './assets/product-placeholder.svg';
  }
};

/** Calculate a discounted price without changing the original amount. */
export const calculateDiscount = (price, percent = 0) => {
  const amount = Number(price);
  const rate = Number(percent);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate)) return 0;
  return amount * (1 - Math.min(100, Math.max(0, rate)) / 100);
};

/** Convert a phrase into a lowercase, URL-friendly slug. */
export const slugify = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

/** Create a reusable predicate-based array filter. */
export const filterBy = (predicate) => (items = []) => items.filter(predicate);

/** Create a reusable stable array sorter by property name or selector. */
export const sortBy = (key, direction = 'asc') => (items = []) => {
  const getValue = typeof key === 'function' ? key : (item) => item?.[key];
  const multiplier = direction === 'desc' ? -1 : 1;
  return [...items].sort((left, right) => {
    const first = getValue(left);
    const second = getValue(right);
    return typeof first === 'string'
      ? first.localeCompare(String(second ?? '')) * multiplier
      : ((Number(first) || 0) - (Number(second) || 0)) * multiplier;
  });
};

/** Build a closure that keeps a running count and returns its operations. */
export const createCartCounter = (initialCount = 0) => {
  let count = Math.max(0, Number(initialCount) || 0);
  return {
    get: () => count,
    set: (nextCount) => { count = Math.max(0, Number(nextCount) || 0); return count; },
    increment: (amount = 1) => { count += amount; return count; }
  };
};

/** Resolve after a short delay to demonstrate asynchronous payment processing. */
export const simulatePaymentProcessing = async (delay = 350) => new Promise((resolve) => {
  window.setTimeout(() => resolve({ approved: true, reference: `PAY-${Date.now()}` }), delay);
});
