export const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
export const COLORS = ['Black', 'White', 'Navy', 'Beige'];
export const SHIPPING_ZONES = ['Local', 'Nearby', 'Regional'];
export const SHIPPING_OPTIONS = ['standard', 'express', 'same-day'];
export const SHIPPING_RATES = [
  [0, 8, 15],
  [4, 12, 22],
  [7, 18, 30]
];
export const MEN_SIZE_CHART = [
  ['Size', 'Chest (in)', 'Waist (in)', 'Hip (in)'],
  ['S', 36, 30, 36],
  ['M', 38, 32, 38],
  ['L', 40, 34, 40],
  ['XL', 42, 36, 42]
];
export const WOMEN_SIZE_CHART = [
  ['Size', 'Bust (in)', 'Waist (in)', 'Hip (in)'],
  ['S', 34, 26, 36],
  ['M', 36, 28, 38],
  ['L', 38, 30, 40],
  ['XL', 40, 32, 42]
];

const STOCK_STORAGE_KEY = 'damitan-ni-ron-stock-v1';
const HISTORY_STORAGE_KEY = 'damitan-ni-ron-history-v1';
/** Create the default independent all-zero stock matrix. */
const EMPTY_STOCK = () => createMatrix(SIZES.length, COLORS.length, 0);

/** Create a two-dimensional array without sharing nested row references. */
export function createMatrix(rows, cols, fill = 0) {
  const rowCount = Math.max(0, Math.floor(Number(rows) || 0));
  const columnCount = Math.max(0, Math.floor(Number(cols) || 0));
  return Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => (
    fill && typeof fill === 'object' ? structuredClone(fill) : fill
  )));
}

/** Transpose a rectangular matrix; empty input produces an empty matrix. */
export function transpose(matrix = []) {
  if (!Array.isArray(matrix) || matrix.length === 0) return [];
  const width = Math.min(...matrix.map((row) => Array.isArray(row) ? row.length : 0));
  return Array.from({ length: width }, (_, column) => matrix.map((row) => row[column]));
}

/** Flatten nested arrays by one level or to the requested depth. */
export function flatten(matrix = [], depth = 1) {
  return Array.isArray(matrix) ? matrix.flat(Math.max(0, Number(depth) || 0)) : [];
}

/** Return a defensive copy of one matrix column, or an empty array if invalid. */
export function getColumn(matrix = [], columnIndex) {
  if (!Array.isArray(matrix) || !Number.isInteger(columnIndex) || columnIndex < 0) return [];
  return matrix.filter(Array.isArray).filter((row) => columnIndex < row.length).map((row) => row[columnIndex]);
}

/** Return a defensive copy of one matrix row, or an empty array if invalid. */
export function getRow(matrix = [], rowIndex) {
  return Array.isArray(matrix) && Array.isArray(matrix[rowIndex]) ? [...matrix[rowIndex]] : [];
}

/** Return a copied matrix with one cell updated; invalid coordinates leave it unchanged. */
export function updateCell(matrix = [], rowIndex, columnIndex, value) {
  if (!Array.isArray(matrix) || !Array.isArray(matrix[rowIndex])
    || !Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= matrix[rowIndex].length) {
    return Array.isArray(matrix) ? matrix.map((row) => Array.isArray(row) ? [...row] : []) : [];
  }
  return matrix.map((row, index) => index === rowIndex
    ? row.map((cell, cellIndex) => cellIndex === columnIndex ? value : cell)
    : [...row]);
}

/** Sum numeric cells in a matrix while treating non-numeric values as zero. */
export function sumMatrix(matrix = []) {
  return (Array.isArray(matrix) ? matrix : [])
    .reduce((sum, row) => sum + (Array.isArray(row)
      ? row.reduce((rowSum, value) => rowSum + (Number(value) || 0), 0)
      : 0), 0);
}

/** Find a matching cell and return its coordinates, or null when absent. */
export function findInMatrix(matrix = [], predicate = (value) => Boolean(value)) {
  if (!Array.isArray(matrix)) return null;
  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex];
    if (!Array.isArray(row)) continue;
    const columnIndex = row.findIndex(predicate);
    if (columnIndex >= 0) return [rowIndex, columnIndex];
  }
  return null;
}

/** Split a flat list into fixed-size rows without changing the source array. */
export function chunk(items = [], size = 4) {
  const rowSize = Math.floor(Number(size));
  if (!Number.isInteger(rowSize) || rowSize < 1) throw new RangeError('Chunk size must be a positive integer.');
  if (!Array.isArray(items)) return [];
  return Array.from({ length: Math.ceil(items.length / rowSize) }, (_, rowIndex) => (
    items.slice(rowIndex * rowSize, (rowIndex + 1) * rowSize)
  ));
}

/** Read stored stock matrices and reject malformed storage data. */
function readStockStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STOCK_STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error('Unable to read saved inventory matrices.', error);
    return {};
  }
}

/** Generate a repeatable, independent stock matrix for a product ID. */
function generateStockMatrix(productId) {
  const seed = Number(productId) || 1;
  return SIZES.map((_, rowIndex) => COLORS.map((__, columnIndex) => (
    (seed + rowIndex * 3 + columnIndex * 5) % 7 === 0 ? 0 : 2 + ((seed + rowIndex + columnIndex) % 8)
  )));
}

/** Return a product's stock matrix as a defensive nested copy. */
export function getStockMatrix(productId) {
  const store = readStockStore();
  const key = String(productId);
  const saved = store[key];
  const matrix = Array.isArray(saved) && saved.length === SIZES.length
    && saved.every((row) => Array.isArray(row) && row.length === COLORS.length)
    ? saved.map((row) => row.map((quantity) => Math.max(0, Number(quantity) || 0)))
    : generateStockMatrix(productId);
  if (!saved) {
    store[key] = matrix;
    localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(store));
  }
  return matrix.map((row) => [...row]);
}

/** Decrease one size/color stock cell immutably when enough stock remains. */
export function reserveStock(productId, size, color, quantity = 1) {
  const rowIndex = SIZES.indexOf(size);
  const columnIndex = COLORS.indexOf(color);
  const amount = Math.floor(Number(quantity));
  if (rowIndex < 0 || columnIndex < 0 || !Number.isInteger(amount) || amount < 1) return false;
  const matrix = getStockMatrix(productId);
  if (matrix[rowIndex][columnIndex] < amount) return false;
  const store = readStockStore();
  store[String(productId)] = updateCell(matrix, rowIndex, columnIndex, matrix[rowIndex][columnIndex] - amount);
  localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(store));
  return true;
}

/** Restore quantity to one product's size/color cell using an immutable update. */
export function releaseStock(productId, size, color, quantity = 1) {
  const rowIndex = SIZES.indexOf(size);
  const columnIndex = COLORS.indexOf(color);
  const amount = Math.floor(Number(quantity));
  if (rowIndex < 0 || columnIndex < 0 || !Number.isInteger(amount) || amount < 1) return false;
  const matrix = getStockMatrix(productId);
  const store = readStockStore();
  store[String(productId)] = updateCell(matrix, rowIndex, columnIndex, matrix[rowIndex][columnIndex] + amount);
  localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(store));
  return true;
}

/** Return the first in-stock size/color pair, or null if the item is sold out. */
export function findAvailableVariant(matrix = []) {
  const coords = findInMatrix(matrix, (quantity) => Number(quantity) > 0);
  return coords ? { size: SIZES[coords[0]], color: COLORS[coords[1]] } : null;
}

/** Return the shipping fee for a selected zone and option. */
export function getShippingFee(zone, option) {
  const zoneIndex = SHIPPING_ZONES.indexOf(zone);
  const optionIndex = SHIPPING_OPTIONS.indexOf(option);
  return zoneIndex < 0 || optionIndex < 0 ? 0 : SHIPPING_RATES[zoneIndex][optionIndex];
}

/** Read saved orders stored as a 3D array of item rows. */
export function getOrderHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? '{"orders":[],"metadata":[]}');
    const orders = Array.isArray(stored.orders) ? stored.orders : [];
    return {
      orders: orders.map((order) => Array.isArray(order) ? order.filter(Array.isArray) : []),
      metadata: Array.isArray(stored.metadata) ? stored.metadata : []
    };
  } catch (error) {
    console.error('Unable to read order history.', error);
    return { orders: [], metadata: [] };
  }
}

/** Save a completed order as a 3D array of [id,title,size,color,quantity,price] rows. */
export function recordOrderHistory(order) {
  const history = getOrderHistory();
  const rows = order.items.map(({ product, quantity, size = 'M', color = 'Black' }) => [
    product.id, product.title, size, color, quantity, product.price
  ]);
  const nextHistory = {
    orders: [...history.orders, rows],
    metadata: [...history.metadata, {
      id: order.id,
      total: order.total,
      shippingFee: Number(order.customer.shippingFee) || 0,
      createdAt: order.createdAt,
      categories: order.items.map(({ product }) => product.category)
    }]
  };
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

/** Remove a cancelled order from the stored history. */
export function removeOrderHistory(orderId) {
  const history = getOrderHistory();
  const index = history.metadata.findIndex(({ id }) => String(id) === String(orderId));
  if (index < 0) return false;
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({
    orders: history.orders.filter((_, orderIndex) => orderIndex !== index),
    metadata: history.metadata.filter((_, orderIndex) => orderIndex !== index)
  }));
  return true;
}

/** Build a category sales summary table from the nested order rows. */
export function getSalesSummary() {
  const { orders, metadata } = getOrderHistory();
  const categories = ["men's clothing", "women's clothing"];
  return [
    ['Category', 'Units sold', 'Product revenue'],
    ...categories.map((category) => {
      const matching = orders.flatMap((order, orderIndex) => order
        .filter((_, itemIndex) => metadata[orderIndex]?.categories?.[itemIndex] === category));
      const units = matching.reduce((total, row) => total + (Number(row[4]) || 0), 0);
      const revenue = matching.reduce((total, row) => total + (Number(row[4]) || 0) * (Number(row[5]) || 0), 0);
      return [category, units, revenue];
    })
  ];
}

/** Calculate aggregate order history totals using flattening and nested reductions. */
export function getHistoryTotals() {
  const { orders } = getOrderHistory();
  const itemRows = orders.flat();
  const units = orders.reduce((total, order) => total + order.reduce((orderTotal, row) => orderTotal + (Number(row[4]) || 0), 0), 0);
  const flatMapUnits = orders.flatMap((order) => order).reduce((total, row) => total + (Number(row[4]) || 0), 0);
  return { orderCount: orders.length, lineCount: itemRows.length, units, flatMapUnits };
}

/** Render any 2D array as a semantic HTML table using DOM creation methods. */
export function renderMatrixTable(matrix = [], { className = 'data-table' } = {}) {
  const table = document.createElement('table');
  table.className = className;
  if (!Array.isArray(matrix) || matrix.length === 0) return table;
  const [headerRow, ...bodyRows] = matrix;
  const head = document.createElement('thead');
  const header = document.createElement('tr');
  headerRow.forEach((value) => {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = String(value ?? '');
    header.appendChild(cell);
  });
  head.appendChild(header);
  const body = document.createElement('tbody');
  bodyRows.forEach(([rowLabel, ...values]) => {
    const row = document.createElement('tr');
    values.forEach((value, index) => {
      const cell = document.createElement('td');
      cell.textContent = String(value ?? '');
      row.appendChild(cell);
    });
    if (rowLabel !== undefined) {
      const label = document.createElement('th');
      label.scope = 'row';
      label.textContent = String(rowLabel);
      row.insertBefore(label, row.firstChild);
    }
    body.appendChild(row);
  });
  table.append(head, body);
  return table;
}

/** Build a matrix table from explicit labels and values (including stock cells). */
export function renderLabeledMatrixTable(rowLabels, columnLabels, matrix, options = {}) {
  const tableRows = [[options.cornerLabel ?? '', ...columnLabels],
    ...rowLabels.map((rowLabel, rowIndex) => [rowLabel, ...(matrix[rowIndex] ?? [])])];
  const table = document.createElement('table');
  table.className = options.className ?? 'data-table';
  const head = document.createElement('thead');
  const heading = document.createElement('tr');
  tableRows[0].forEach((value) => {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = String(value);
    heading.appendChild(cell);
  });
  head.appendChild(heading);
  const body = document.createElement('tbody');
  tableRows.slice(1).forEach(([size, ...values], rowIndex) => {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = String(size);
    row.appendChild(label);
    values.forEach((quantity, columnIndex) => {
      const cell = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = 'select-variant';
      button.dataset.size = String(size);
      button.dataset.color = String(columnLabels[columnIndex]);
      button.textContent = String(quantity);
      button.disabled = Number(quantity) <= 0;
      button.className = button.disabled ? 'stock-cell stock-cell--empty' : 'stock-cell';
      button.setAttribute('aria-label', `${size} ${columnLabels[columnIndex]}: ${quantity} in stock`);
      button.setAttribute('aria-pressed', 'false');
      cell.appendChild(button);
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  table.append(head, body);
  return table;
}

/** Return an independent all-zero matrix for a requested stock shape. */
export function createEmptyStockMatrix() {
  return EMPTY_STOCK();
}
