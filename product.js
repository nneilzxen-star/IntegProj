import { formatCurrency } from './utils.js';

const CLOTHING_CATEGORIES = ["men's clothing", "women's clothing"];

/**
 * A validated product model shared by catalog, cart, and order code.
 */
export class Product {
  #id;
  #price;

  /**
   * Create a product from normalized storefront data.
   * @param {{ id: number, title: string, price: number, category: string, image?: string, rating?: { rate: number, count: number }, description?: string }} data Product attributes.
   */
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.price = data.price;
    this.category = data.category;
    this.image = data.image ?? './assets/product-placeholder.svg';
    this.rating = { rate: data.rating?.rate ?? 0, count: data.rating?.count ?? 0 };
    this.description = data.description ?? '';
  }

  /** Get the validated numeric product identifier. */
  get id() { return this.#id; }

  /** Set the identifier while requiring a positive whole number. */
  set id(value) {
    const identifier = Number(value);
    if (!Number.isInteger(identifier) || identifier < 1) throw new RangeError('Product id must be a positive whole number.');
    this.#id = identifier;
  }

  /** Get the validated product price. */
  get price() { return this.#price; }

  /** Set the price while rejecting negative and non-numeric values. */
  set price(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Product price must be a non-negative number.');
    this.#price = amount;
  }

  /** Create the correct product subtype from a FakeStore API object. */
  static fromAPI(data) {
    if (data instanceof Product) return data;
    const normalized = {
      id: Number(data?.id),
      title: String(data?.title ?? '').trim() || 'Untitled piece',
      price: Number(data?.price),
      category: String(data?.category ?? '').trim(),
      image: typeof data?.image === 'string' && data.image.trim() ? data.image : './assets/product-placeholder.svg',
      rating: {
        rate: Number(data?.rating?.rate) || 0,
        count: Number(data?.rating?.count) || 0
      },
      description: String(data?.description ?? '').trim()
    };
    if (!Number.isInteger(normalized.id) || normalized.id < 1 || !Number.isFinite(normalized.price) || normalized.price < 0) return null;
    if (!CLOTHING_CATEGORIES.includes(normalized.category)) return null;

    const isClothing = normalized.category === "men's clothing" || normalized.category === "women's clothing";
    return isClothing ? new ClothingProduct({
      ...normalized,
      gender: data.gender ?? (normalized.category === "men's clothing" ? 'Men' : 'Women'),
      sizes: data.sizes
    }) : new Product(normalized);
  }

  /** Return the display-ready product price. */
  formatPrice() { return formatCurrency(this.#price); }

  /** Return the product description used by detail views. */
  getDescription() { return this.description || 'A thoughtful addition to your everyday wardrobe.'; }

  /** Serialize private fields into a JSON-safe product object. */
  toJSON() {
    return {
      id: this.#id,
      title: this.title,
      price: this.#price,
      category: this.category,
      image: this.image,
      rating: { ...this.rating },
      description: this.description
    };
  }
}

/**
 * Clothing-specific product with gender and available size information.
 */
export class ClothingProduct extends Product {
  /**
   * Create a clothing product.
   * @param {{ id: number, title: string, price: number, category: string, image?: string, rating?: { rate: number, count: number }, description?: string, gender?: string, sizes?: string[] }} data Clothing attributes.
   */
  constructor(data) {
    super(data);
    this.gender = data.gender ?? (data.category === "men's clothing" ? 'Men' : 'Women');
    this.size = [...(data.sizes ?? ['S', 'M', 'L', 'XL'])];
  }

  /** Override the base description with clothing-specific details (polymorphism). */
  getDescription() {
    return `${super.getDescription()} Available sizes: ${this.size.join(', ')}.`;
  }

  /** Serialize base product data and clothing-specific fields. */
  toJSON() { return { ...super.toJSON(), gender: this.gender, sizes: [...this.size] }; }
}
