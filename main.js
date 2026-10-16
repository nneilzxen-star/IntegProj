import { fetchProductById, fetchStoreCatalog } from './api.js';
import { addCartProduct, clearCart, getCartModel, getState, removeCartProduct, setCartQuantity, setCatalog, subscribe } from './state.js';
import { cancelOrder, submitOrder, syncCartWithApi } from './cart.js';
import { setupCheckoutValidation, validateCheckoutForm, validateField, validateNewsletterForm } from './validation.js';
import {
  getProduct,
  getVisibleProducts,
  hideProductState,
  renderCart,
  renderCategories,
  renderCheckoutSummary,
  renderConfirmation,
  renderLoading,
  renderProductDetails,
  renderProducts,
  renderProductState,
  renderHistory,
  renderDataMatrix,
  renderSizeChart,
  showToast,
  readWishlistIds
} from './ui.js';
import { createCartCounter, debounce, formatCurrency } from './utils.js';
import {
  COLORS, MEN_SIZE_CHART, SHIPPING_OPTIONS, SHIPPING_RATES, SHIPPING_ZONES, SIZES, WOMEN_SIZE_CHART,
  findAvailableVariant, getShippingFee, getStockMatrix, recordOrderHistory,
  releaseStock, removeOrderHistory, reserveStock
} from './matrix.js';

const elements = {
  grid: document.getElementById('product-grid'),
  productState: document.getElementById('product-state'),
  resultsCount: document.getElementById('results-count'),
  search: document.getElementById('search-input'),
  category: document.getElementById('category-filter'),
  minPrice: document.getElementById('min-price-filter'),
  price: document.getElementById('price-filter'),
  priceSlider: document.getElementById('price-slider'),
  sort: document.getElementById('sort-filter'),
  clearFilters: document.getElementById('clear-filters'),
  cartDrawer: document.getElementById('cart-drawer'),
  cartBackdrop: document.getElementById('drawer-backdrop'),
  cartItems: document.getElementById('cart-items'),
  cartEmpty: document.getElementById('cart-empty'),
  cartFooter: document.getElementById('cart-footer'),
  cartCount: document.getElementById('cart-count'),
  cartTotal: document.getElementById('cart-total'),
  openCart: document.getElementById('open-cart'),
  detailDialog: document.getElementById('product-dialog'),
  detailContent: document.getElementById('product-detail-content'),
  checkoutDialog: document.getElementById('checkout-dialog'),
  checkoutForm: document.getElementById('checkout-form'),
  placeOrder: document.getElementById('place-order'),
  checkoutItems: document.getElementById('checkout-items'),
  checkoutTotal: document.getElementById('checkout-total'),
  confirmationDialog: document.getElementById('confirmation-dialog'),
  confirmationContent: document.getElementById('confirmation-content'),
  sizeGuideDialog: document.getElementById('size-guide-dialog'),
  sizeGuideContent: document.getElementById('size-guide-content'),
  historyDialog: document.getElementById('history-dialog'),
  historyContent: document.getElementById('history-content'),
  shippingRates: document.getElementById('shipping-rates-table'),
  shippingRegion: document.getElementById('shipping-region'),
  shippingOption: document.getElementById('shipping-option'),
  toastRegion: document.getElementById('toast-region')
};

const observeReveals = () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal').forEach((section) => section.classList.add('is-visible'));
    return;
  }
  revealObserver ??= new IntersectionObserver((entries, observer) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (isIntersecting) {
        target.classList.add('is-visible');
        observer.unobserve(target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal:not(.is-visible)').forEach((section) => revealObserver.observe(section));
};

const initializeTheme = () => {
  let theme = 'light';
  try {
    theme = localStorage.getItem('damitan-ni-ron-theme') ?? 'light';
  } catch (error) {
    console.error('Unable to load the saved color theme.', error);
  }
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  const button = document.getElementById('theme-toggle');
  button.setAttribute('aria-pressed', String(theme === 'dark'));
  button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
};

const updateWishlist = (productId, button) => {
  const ids = readWishlistIds();
  const key = String(productId);
  const nextIds = ids.includes(key) ? ids.filter((id) => id !== key) : [...ids, key];
  try {
    localStorage.setItem('damitan-ni-ron-wishlist', JSON.stringify(nextIds));
    button.setAttribute('aria-pressed', String(nextIds.includes(key)));
    const product = getProduct(productId);
    if (product) {
      const isSaved = nextIds.includes(key);
      button.setAttribute('aria-label', `${isSaved ? 'Remove' : 'Save'} ${product.title} ${isSaved ? 'from' : 'to'} wishlist`);
    }
    showToast(nextIds.includes(key) ? 'Saved to your wishlist.' : 'Removed from your wishlist.', elements.toastRegion);
    renderListing();
  } catch (error) {
    console.error('Unable to save wishlist changes.', error);
    showToast('Your wishlist could not be saved in this browser.', elements.toastRegion, true);
  }
};

const setWishlistMode = (enabled, button = document.getElementById('wishlist-toggle')) => {
  wishlistOnly = enabled;
  button.setAttribute('aria-pressed', String(enabled));
  button.setAttribute('aria-label', enabled ? 'Show all products' : 'Show wishlist');
};

const cartModel = getCartModel();
const cartCounter = createCartCounter();
let catalogRequestId = 0;
let detailRequestId = 0;
let pendingCategory = null;
let lastOrder = null;
let catalogLoaded = false;
let wishlistOnly = false;
let revealObserver;
let catalogLayout = 'grid';

const renderListing = () => {
  const { products } = getState();
  const minPrice = Number(elements.minPrice.value);
  const maxPrice = Number(elements.price.value);
  const wishlistIds = readWishlistIds();
  const listingProducts = wishlistOnly
    ? products.filter(({ id }) => wishlistIds.includes(String(id)))
    : products;
  const visibleProducts = getVisibleProducts(listingProducts, {
    search: elements.search.value,
    category: elements.category.value,
    minPrice: Number.isFinite(minPrice) ? minPrice : 0,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : Number.POSITIVE_INFINITY,
    sort: elements.sort.value
  });
  hideProductState(elements.productState);
  renderProducts(visibleProducts, elements.grid, elements.resultsCount, catalogLayout);
  observeReveals();
  if (products.length > 0 && visibleProducts.length === 0) {
    renderProductState(elements.productState, {
      title: 'Nothing in this edit.',
      message: 'Try a different search or loosen your filters.'
    });
  }
};

const loadCatalog = async () => {
  const requestId = ++catalogRequestId;
  renderLoading(elements.grid);
  elements.resultsCount.textContent = 'Finding your favorites…';
  elements.productState.hidden = true;
  try {
    const catalog = await fetchStoreCatalog();
    if (requestId !== catalogRequestId) return;
    setCatalog(catalog);
    renderCategories(catalog.categories, elements.category);
    const menImage = catalog.products.find(({ category }) => category === "men's clothing")?.image;
    const womenImage = catalog.products.find(({ category }) => category === "women's clothing")?.image;
    if (menImage) document.getElementById('category-men-image').src = menImage;
    if (womenImage) document.getElementById('category-women-image').src = womenImage;
    if (pendingCategory) elements.category.value = pendingCategory;
    pendingCategory = null;
    catalogLoaded = true;
    if (catalog.products.length === 0) {
      elements.grid.replaceChildren();
      renderProductState(elements.productState, {
        title: 'The edit is taking a breather.',
        message: 'There are no clothing pieces available right now. Please try again.',
        retry: true
      });
    } else {
      renderListing();
    }
  } catch (error) {
    if (requestId !== catalogRequestId) return;
    console.error('Unable to load the clothing collection.', error);
    elements.grid.replaceChildren();
    elements.resultsCount.textContent = 'The collection could not load.';
    renderProductState(elements.productState, {
      title: 'A little pause.',
      message: 'We couldn’t reach the collection. Check your connection and try again.',
      retry: true
    });
  } finally {
    if (requestId === catalogRequestId) elements.grid.setAttribute('aria-busy', 'false');
  }
};

const renderBag = () => {
  const { cart } = getState();
  renderCart(
    cart, elements.cartDrawer, elements.cartItems, elements.cartEmpty, elements.cartFooter,
    elements.cartCount, elements.cartTotal, elements.openCart
  );
  if (elements.checkoutDialog.open) {
    updateCheckoutSummary();
  }
};

/** Build the concise shipping label shown in the checkout total. */
const getShippingLabel = () => `${elements.shippingOption.selectedOptions[0]?.textContent ?? 'Standard'} · ${elements.shippingRegion.value}`;

/** Re-render line items and the current region/option rate in the checkout summary. */
const updateCheckoutSummary = () => renderCheckoutSummary(
  getState().cart,
  elements.checkoutItems,
  elements.checkoutTotal,
  getShippingFee(elements.shippingRegion.value, elements.shippingOption.value),
  getShippingLabel()
);

/** Render the shipping lookup matrix as a semantic data table. */
const renderShippingRates = () => {
  const matrix = [
    ['Zone', ...SHIPPING_OPTIONS.map((option) => option.replace('-', ' '))],
    ...SHIPPING_ZONES.map((zone, rowIndex) => [zone, ...SHIPPING_RATES[rowIndex].map(formatCurrency)])
  ];
  renderDataMatrix(matrix, elements.shippingRates, { className: 'data-table shipping-rate-table' });
};

const openCart = () => {
  elements.cartBackdrop.hidden = false;
  requestAnimationFrame(() => elements.cartBackdrop.classList.add('is-visible'));
  elements.cartDrawer.classList.add('is-open');
  elements.cartDrawer.setAttribute('aria-hidden', 'false');
  elements.cartDrawer.inert = false;
  elements.openCart.setAttribute('aria-expanded', 'true');
  document.getElementById('close-cart').focus();
};

const closeCart = () => {
  elements.cartDrawer.classList.remove('is-open');
  elements.cartBackdrop.classList.remove('is-visible');
  elements.cartDrawer.setAttribute('aria-hidden', 'true');
  elements.cartDrawer.inert = true;
  elements.openCart.setAttribute('aria-expanded', 'false');
  window.setTimeout(() => {
    if (!elements.cartDrawer.classList.contains('is-open')) elements.cartBackdrop.hidden = true;
  }, 280);
  elements.openCart.focus();
};

const addProduct = (product, size, color) => {
  if (!product) return;
  let reservedVariant = null;
  try {
    reservedVariant = size && color ? { size, color } : findAvailableVariant(getStockMatrix(product.id));
    if (!reservedVariant || !reserveStock(product.id, reservedVariant.size, reservedVariant.color)) {
      showToast('That size and color combination is out of stock.', elements.toastRegion, true);
      return;
    }
    addCartProduct(product, reservedVariant);
    openCart();
    showToast(`${product.title} · ${reservedVariant.size} / ${reservedVariant.color} added to your bag.`, elements.toastRegion);
    syncCartWithApi().catch((error) => {
      console.error('Unable to sync the shopping bag.', error);
      showToast('Your bag is saved here, but could not sync with the demo store.', elements.toastRegion, true);
    });
  } catch (error) {
    if (reservedVariant) releaseStock(product.id, reservedVariant.size, reservedVariant.color);
    showToast(error.message, elements.toastRegion, true);
  }
};

const openProductDetails = async (id) => {
  const requestId = ++detailRequestId;
  elements.detailDialog.dataset.productId = id;
  renderProductState(elements.detailContent, {
    title: 'Loading this piece…',
    message: 'A moment while we bring up the details.'
  });
  elements.detailDialog.showModal();
  try {
    const product = await fetchProductById(id);
    if (requestId !== detailRequestId) return;
    renderProductDetails(product, elements.detailContent, getStockMatrix(product.id));
  } catch (error) {
    if (requestId !== detailRequestId) return;
    console.error('Unable to load product details.', error);
    renderProductState(elements.detailContent, {
      title: 'Couldn’t load this piece.',
      message: 'Please check your connection and try again.',
      retry: true
    });
  }
};

const openCheckout = () => {
  if (getState().cart.length === 0) return;
  closeCart();
  elements.checkoutForm.reset();
  const cardField = document.getElementById('card-field');
  const cardInput = elements.checkoutForm.elements.cardNumber;
  cardField.hidden = true;
  cardInput.required = false;
  elements.checkoutForm.querySelectorAll('input, select, textarea').forEach((field) => {
    field.setCustomValidity('');
    field.classList.remove('is-valid', 'is-invalid');
    field.removeAttribute('aria-invalid');
  });
  elements.checkoutForm.querySelectorAll('.form-error').forEach((error) => { error.textContent = ''; });
  elements.placeOrder.disabled = true;
  elements.shippingRegion.value = 'Local';
  elements.shippingOption.value = 'standard';
  updateCheckoutSummary();
  elements.checkoutDialog.showModal();
};

const onCartAction = (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const productId = Number(actionButton.dataset.productId ?? actionButton.closest('.cart-item')?.dataset.productId);
  const { size, color } = actionButton.dataset;
  const item = getState().cart.find(({ product, size: itemSize, color: itemColor }) => (
    product.id === productId && itemSize === size && itemColor === color
  ));
  if (actionButton.dataset.action === 'increase' && item) {
    if (!reserveStock(productId, size, color)) {
      showToast('There is no more stock for this variant.', elements.toastRegion, true);
      return;
    }
    setCartQuantity(productId, item.quantity + 1, size, color);
  }
  if (actionButton.dataset.action === 'decrease' && item) {
    releaseStock(productId, size, color);
    setCartQuantity(productId, item.quantity - 1, size, color);
  }
  if (actionButton.dataset.action === 'remove' && item) {
    releaseStock(productId, size, color, item.quantity);
    removeCartProduct(productId, size, color);
  }

  if (['increase', 'decrease', 'remove'].includes(actionButton.dataset.action)) {
    syncCartWithApi().catch((error) => {
      console.error('Unable to sync the updated shopping bag.', error);
      showToast('The bag changed here, but could not sync with the demo store.', elements.toastRegion, true);
    });
  }
};

/** Update selected size/color controls and enable add-to-bag only for stocked variants. */
const updateDetailSelection = (button) => {
  const detail = button.closest('.product-detail');
  if (!detail) return;
  if (button.dataset.size) detail.dataset.selectedSize = button.dataset.size;
  if (button.dataset.color) detail.dataset.selectedColor = button.dataset.color;
  const { selectedSize, selectedColor } = detail.dataset;
  detail.querySelectorAll('[data-action="select-size"]').forEach((option) => {
    option.setAttribute('aria-pressed', String(option.dataset.size === selectedSize));
  });
  detail.querySelectorAll('[data-action="select-color"]').forEach((option) => {
    option.setAttribute('aria-pressed', String(option.dataset.color === selectedColor));
  });
  detail.querySelectorAll('[data-action="select-variant"]').forEach((option) => {
    option.setAttribute('aria-pressed', String(option.dataset.size === selectedSize && option.dataset.color === selectedColor));
  });
  const matrix = getStockMatrix(elements.detailDialog.dataset.productId);
  const sizeIndex = SIZES.indexOf(selectedSize);
  const colorIndex = COLORS.indexOf(selectedColor);
  const quantity = matrix[sizeIndex]?.[colorIndex] ?? 0;
  const addButton = detail.querySelector('[data-action="add-detail"]');
  addButton.disabled = quantity <= 0;
  addButton.textContent = quantity > 0 ? `Add to bag · ${quantity} left` : 'Out of stock';
};

/** Select the size chart for the chosen clothing department and open its dialog. */
const openSizeGuide = (gender) => {
  const chart = gender === 'Men' ? MEN_SIZE_CHART : WOMEN_SIZE_CHART;
  renderSizeChart(chart, elements.sizeGuideContent, `${gender} size guide`);
  elements.sizeGuideDialog.showModal();
};

const onOrderSubmit = async (event) => {
  event.preventDefault();
  const valid = validateCheckoutForm(elements.checkoutForm);
  elements.placeOrder.disabled = !valid;
  if (!valid) {
    elements.checkoutForm.querySelector(':invalid')?.focus();
    return;
  }

  elements.placeOrder.disabled = true;
  elements.placeOrder.textContent = 'Processing payment…';
  const formData = new FormData(elements.checkoutForm);
  const { cardNumber: _cardNumber, terms: _terms, ...customer } = Object.fromEntries(formData.entries());
  customer.shippingFee = getShippingFee(customer.region, customer.shipping);
  try {
    lastOrder = await submitOrder(customer);
    try {
      recordOrderHistory(lastOrder);
    } catch (historyError) {
      console.error('Unable to save the order history.', historyError);
      showToast('Your order was placed, but this browser could not save its history.', elements.toastRegion, true);
    }
    elements.checkoutDialog.close();
    renderConfirmation(lastOrder, elements.confirmationContent);
    elements.confirmationDialog.showModal();
  } catch (error) {
    console.error('Checkout could not be completed.', error);
    showToast('We couldn’t place your order. Your bag is still saved; please try again.', elements.toastRegion, true);
    elements.placeOrder.disabled = false;
  } finally {
    elements.placeOrder.textContent = 'Place order';
  }
};

const onNewsletterSubmit = (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!validateNewsletterForm(form)) {
    form.reportValidity();
    form.elements.email.focus();
    return;
  }

  const { email } = Object.fromEntries(new FormData(form).entries());
  document.getElementById('newsletter-status').textContent = `You’re on the list, ${email}.`;
  form.reset();
  form.elements.email.classList.remove('is-valid');
};

const cancelConfirmedOrder = async (cancelButton) => {
  if (!lastOrder) return;
  cancelButton.disabled = true;
  try {
    await cancelOrder(lastOrder.id);
    lastOrder.items.forEach(({ product, quantity, size, color }) => releaseStock(product.id, size, color, quantity));
    removeOrderHistory(lastOrder.id);
    clearCart();
    elements.confirmationDialog.close();
    showToast('Your order has been cancelled.', elements.toastRegion);
  } catch (error) {
    console.error('Unable to cancel the order.', error);
    showToast('We could not cancel this order with the demo store.', elements.toastRegion, true);
    cancelButton.disabled = false;
  }
};

const onScroll = () => {
  const scrolled = window.scrollY > 32;
  document.querySelector('.site-header').classList.toggle('is-scrolled', scrolled);
  document.getElementById('back-to-top').classList.toggle('is-visible', window.scrollY > 500);
};

const onResize = () => {
  document.documentElement.style.setProperty('--viewport-width', `${window.innerWidth}px`);
};

const bindEvents = () => {
  const debouncedRender = debounce(renderListing, 180);
  const filters = document.getElementById('filters');
  const headerSearch = document.getElementById('header-search');
  const wishlistToggle = document.getElementById('wishlist-toggle');
  const themeToggle = document.getElementById('theme-toggle');
  const headerSearchForm = document.getElementById('header-search-form');
  headerSearch.addEventListener('input', debounce(() => {
    elements.search.value = headerSearch.value;
    renderListing();
  }, 180));
  headerSearchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    elements.search.value = headerSearch.value;
    renderListing();
    document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
  });
  filters.addEventListener('input', (event) => {
    if (event.target === elements.search) {
      headerSearch.value = elements.search.value;
      debouncedRender();
    }
    else {
      if (event.target === elements.priceSlider) elements.price.value = event.target.value;
      if (event.target === elements.price) {
        elements.priceSlider.value = String(Math.min(1000, Math.max(0, Number(event.target.value) || 0)));
      }
      renderListing();
    }
  });
  filters.addEventListener('change', (event) => {
    if (event.currentTarget.contains(event.target)) renderListing();
  });
  filters.addEventListener('submit', (event) => {
    event.preventDefault();
    renderListing();
  });
  elements.search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      renderListing();
    }
  });
  elements.clearFilters.addEventListener('click', () => {
    elements.search.value = '';
    headerSearch.value = '';
    setWishlistMode(false, wishlistToggle);
    elements.category.value = 'all';
    elements.minPrice.value = '0';
    elements.price.value = '1000';
    elements.priceSlider.value = '1000';
    elements.sort.value = 'featured';
    renderListing();
  });
  elements.grid.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (action?.dataset.action === 'wishlist') {
      event.preventDefault();
      event.stopPropagation();
      updateWishlist(action.dataset.productId, action);
      return;
    }
    if (action?.dataset.action === 'add') {
      addProduct(getProduct(action.dataset.productId));
      return;
    }
    const card = event.target.closest('.product-card');
    if (card?.dataset.productId) void openProductDetails(card.dataset.productId);
  });
  elements.grid.addEventListener('keydown', (event) => {
    const card = event.target.closest('.product-card');
    if (card && (event.key === 'Enter' || event.key === ' ')) {
      if (event.target.closest('button')) return;
      event.preventDefault();
      void openProductDetails(card.dataset.productId);
    }
  });
  elements.productState.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="retry"]')) void loadCatalog();
  });
  elements.openCart.addEventListener('click', openCart);
  document.getElementById('close-cart').addEventListener('click', closeCart);
  elements.cartBackdrop.addEventListener('click', closeCart);
  document.getElementById('continue-shopping').addEventListener('click', closeCart);
  elements.cartItems.addEventListener('click', onCartAction);
  document.getElementById('checkout-button').addEventListener('click', openCheckout);
  elements.detailContent.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="retry"]')) {
      void openProductDetails(elements.detailDialog.dataset.productId);
      return;
    }
    const variantButton = event.target.closest('[data-action="select-size"], [data-action="select-color"], [data-action="select-variant"]');
    if (variantButton) {
      updateDetailSelection(variantButton);
      return;
    }
    const guideButton = event.target.closest('[data-action="size-guide"]');
    if (guideButton) {
      openSizeGuide(guideButton.dataset.gender);
      return;
    }
    const button = event.target.closest('[data-action="add-detail"]');
    if (button) {
      const product = getProduct(button.dataset.productId);
      if (product) {
        const detail = button.closest('.product-detail');
        const { selectedSize, selectedColor } = detail.dataset;
        elements.detailDialog.close();
        addProduct(product, selectedSize, selectedColor);
      }
    }
  });
  document.addEventListener('click', (event) => {
    const closeButton = event.target.closest('[data-close-dialog]');
    if (closeButton) closeButton.closest('dialog')?.close();
  });
  elements.checkoutForm.addEventListener('submit', onOrderSubmit);
  const updateCheckoutValidity = setupCheckoutValidation(elements.checkoutForm, elements.placeOrder);
  elements.checkoutForm.addEventListener('focusin', (event) => {
    event.target.closest('.form-field')?.classList.add('is-focused');
  });
  elements.checkoutForm.addEventListener('focusout', (event) => {
    const field = event.target;
    field.closest('.form-field')?.classList.remove('is-focused');
    if (field.name && field.name !== 'shipping') validateField(elements.checkoutForm, field.name);
  });
  elements.checkoutForm.elements.payment.addEventListener('change', (event) => {
    const cardField = document.getElementById('card-field');
    const cardInput = elements.checkoutForm.elements.cardNumber;
    const requiresCard = event.target.value === 'card';
    cardField.hidden = !requiresCard;
    cardInput.required = requiresCard;
    if (!requiresCard) {
      cardInput.value = '';
      cardInput.setCustomValidity('');
      cardInput.classList.remove('is-valid', 'is-invalid');
    }
    validateField(elements.checkoutForm, 'cardNumber');
    updateCheckoutValidity();
  });
  const newsletterForm = document.getElementById('newsletter-form');
  newsletterForm.addEventListener('submit', onNewsletterSubmit);
  newsletterForm.addEventListener('input', () => validateNewsletterForm(newsletterForm));
  newsletterForm.addEventListener('focusout', () => validateNewsletterForm(newsletterForm));
  elements.confirmationContent.addEventListener('click', (event) => {
    const cancelButton = event.target.closest('[data-action="cancel-order"]');
    if (cancelButton) {
      void cancelConfirmedOrder(cancelButton);
      return;
    }
    if (event.target.closest('[data-action="dismiss-confirmation"]')) {
      elements.confirmationDialog.close();
      lastOrder = null;
    }
  });
  document.querySelectorAll('[data-nav-category]').forEach((link) => {
    link.addEventListener('click', () => {
      if (catalogLoaded) {
        elements.category.value = link.dataset.navCategory;
        setWishlistMode(false, wishlistToggle);
        renderListing();
      } else {
        pendingCategory = link.dataset.navCategory;
      }
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const topDialog = [elements.historyDialog, elements.sizeGuideDialog, elements.confirmationDialog, elements.checkoutDialog, elements.detailDialog]
        .find((dialog) => dialog.open);
      if (topDialog) {
        event.preventDefault();
        topDialog.close();
      } else if (elements.cartDrawer.classList.contains('is-open')) {
        event.preventDefault();
        closeCart();
      }
    }
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      headerSearch.focus();
    }
    if (event.key === 'Tab' && elements.cartDrawer.classList.contains('is-open')) {
      const focusable = [...elements.cartDrawer.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.closest('[hidden]') && element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  document.getElementById('back-to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.getElementById('view-toggle').addEventListener('click', (event) => {
    catalogLayout = catalogLayout === 'grid' ? 'rows' : 'grid';
    event.currentTarget.setAttribute('aria-pressed', String(catalogLayout === 'rows'));
    event.currentTarget.textContent = catalogLayout === 'grid' ? 'Grid view / Row view' : 'Row view / Grid view';
    renderListing();
  });
  document.getElementById('open-order-history').addEventListener('click', () => {
    renderHistory(elements.historyContent);
    elements.historyDialog.showModal();
  });
  elements.shippingRegion.addEventListener('change', updateCheckoutSummary);
  elements.shippingOption.addEventListener('change', updateCheckoutSummary);
  renderShippingRates();
  themeToggle.addEventListener('click', (event) => {
    const isDark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    event.currentTarget.setAttribute('aria-pressed', String(isDark));
    event.currentTarget.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    try {
      localStorage.setItem('damitan-ni-ron-theme', isDark ? 'dark' : 'light');
    } catch (error) {
      console.error('Unable to save the color theme.', error);
      showToast('Theme changed for this visit, but could not be saved.', elements.toastRegion, true);
    }
  });
  wishlistToggle.addEventListener('click', (event) => {
    setWishlistMode(!wishlistOnly, event.currentTarget);
    renderListing();
    document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
  });
  document.querySelectorAll('[data-category-link]').forEach((link) => {
    link.addEventListener('click', () => {
      elements.category.value = link.dataset.categoryLink;
      setWishlistMode(false, wishlistToggle);
      renderListing();
    });
    document.addEventListener('click', (event) => {
      const button = event.target.closest('.button:not(:disabled)');
      if (!button) return;
      const bounds = button.getBoundingClientRect();
      button.style.setProperty('--ripple-x', `${event.clientX - bounds.left}px`);
      button.style.setProperty('--ripple-y', `${event.clientY - bounds.top}px`);
      button.classList.remove('is-rippling');
      requestAnimationFrame(() => button.classList.add('is-rippling'));
      button.addEventListener('animationend', () => button.classList.remove('is-rippling'), { once: true });
    });
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  onScroll();
  onResize();
  const updateCartBadge = (event) => {
    const count = cartCounter.set(event.detail.items.reduce((total, item) => total + item.quantity, 0));
    if (count > Number(elements.cartCount.textContent)) {
      elements.cartCount.classList.remove('is-bouncing');
      requestAnimationFrame(() => elements.cartCount.classList.add('is-bouncing'));
    }
    elements.cartCount.textContent = String(count);
    elements.openCart.setAttribute('aria-label', `Open shopping bag, ${count} ${count === 1 ? 'item' : 'items'}`);
  };
  cartModel.addEventListener('cart:updated', updateCartBadge);
  updateCartBadge({ detail: { items: getState().cart } });
  subscribe(renderBag);

  const cleanupWindowEvents = () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    cartModel.removeEventListener('cart:updated', updateCartBadge);
    document.removeEventListener('pagehide', cleanupWindowEvents);
  };
  document.addEventListener('pagehide', cleanupWindowEvents, { once: true });
};

const initializeStore = () => {
  initializeTheme();
  bindEvents();
  renderBag();
  observeReveals();
  void loadCatalog();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeStore, { once: true });
} else {
  initializeStore();
}
