import { Product } from './product.js';

const API_BASE_URL = 'https://fakestoreapi.com';

/**
 * Typed service layer for every FakeStore API request.
 */
export class ApiService {
  /**
   * Create an API service with a configurable base URL for testing.
   * @param {string} baseUrl FakeStore-compatible API root.
   */
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Fetch JSON and reject non-success HTTP responses.
   * @param {string} path API path.
   * @param {RequestInit} options Fetch options.
   * @returns {Promise<any>} Parsed JSON response.
   */
  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
    if (!response.ok) throw new Error(`Store service returned ${response.status} ${response.statusText}.`);
    return response.json();
  }

  /** Fetch the clothing catalog and allowed categories concurrently. */
  async getCatalog() {
    const [rawProducts, rawCategories] = await Promise.all([
      this.request('/products'),
      this.request('/products/categories')
    ]);
    if (!Array.isArray(rawProducts) || !Array.isArray(rawCategories)) {
      throw new Error('The store returned an unexpected catalog response.');
    }
    const categories = rawCategories
      .filter((category) => ["men's clothing", "women's clothing"].includes(category))
      .filter((category, index, all) => all.indexOf(category) === index);
    const products = rawProducts.map((item) => Product.fromAPI(item)).filter(Boolean);
    return { products, categories };
  }

  /** Fetch one allowed clothing product by identifier. */
  async getProduct(id) {
    const product = Product.fromAPI(await this.request(`/products/${encodeURIComponent(id)}`));
    if (!product) throw new Error('This clothing item could not be found.');
    return product;
  }

  /** Create a remote cart/order snapshot. */
  async createCart(products) {
    const payload = { userId: 1, date: new Date().toISOString(), products };
    return this.request('/carts', { method: 'POST', body: JSON.stringify(payload) });
  }

  /** Update a remote cart snapshot. */
  async updateCart(id, products) {
    const payload = { userId: 1, date: new Date().toISOString(), products };
    return this.request(`/carts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  /** Delete a remote cart/order snapshot. */
  async deleteCart(id) {
    return this.request(`/carts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

const apiService = new ApiService();

/** Load normalized clothing products and categories. */
export const fetchStoreCatalog = () => apiService.getCatalog();
/** Load one normalized clothing product. */
export const fetchProductById = (id) => apiService.getProduct(id);
/** Create a FakeStore cart snapshot. */
export const createRemoteCart = (products) => apiService.createCart(products);
/** Update a FakeStore cart snapshot. */
export const updateRemoteCart = (id, products) => apiService.updateCart(id, products);
/** Delete a FakeStore cart snapshot. */
export const deleteRemoteCart = (id) => apiService.deleteCart(id);
