/**
 * Выручка по позиции
 * @param purchase { sale_price, quantity, discount? }
 * @param _product {any}
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { sale_price = 0, quantity = 0, discount = 0 } = purchase || {};
  const k = 1 - Number(discount) / 100;
  return Number(sale_price) * Number(quantity) * k;
}

// Округление до 2 знаков, вернуть числом
function round2(x) {
  return +Number(x || 0).toFixed(2);
}

/**
 * Бонус по позиции в рейтинге
 * @param {number} index
 * @param {number} total
 * @param {{profit:number}} seller
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const profit = Number(seller?.profit || 0);
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  if (index === total - 1) return 0;
  return profit * 0.05;
}

/**
 * Анализ данных продаж
 * @param {object} data
 * @param {{calculateRevenue:function, calculateBonus:function}} options
 * @returns {{revenue:number, top_products:{sku:string,quantity:number}[], bonus:number, name:string, sales_count:number, profit:number, seller_id:string}[]}
 */
function analyzeSalesData(data, options) {
  // Проверки входа
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.purchase_records)
  ) {
    throw new Error('Некорректные входные данные');
  }
  if (
    !options ||
    typeof options.calculateRevenue !== 'function' ||
    typeof options.calculateBonus !== 'function'
  ) {
    throw new Error('Опции calculateRevenue и calculateBonus обязательны');
  }
  if (data.sellers.length === 0) throw new Error('Пустой sellers');
  if (data.products.length === 0) throw new Error('Пустой products');
  if (data.purchase_records.length === 0) throw new Error('Пустой purchase_records');

  // Базовые карточки продавцов
  const sellerStats = data.sellers.map(s => ({
    id: s.id,
    seller_id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    name: `${s.first_name} ${s.last_name}`,
    start_date: s.start_date,
    position: s.position,

    revenue: 0,
    profit: 0,
    products_sold: {},   // { sku: суммарное количество }
    sales_count: 0,      // выставим позже как кол-во уникальных SKU
    bonus: 0,
    top_products: []
  }));

  // Индексы
  const sellerIndex  = Object.fromEntries(sellerStats.map(s => [String(s.id), s]));
  const productIndex = Object.fromEntries(data.products.map(p => [String(p.sku), p]));

  // Подсчёты
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[String(record.seller_id)];
    if (!seller) return;

    record.items.forEach(item => {
      const product = productIndex[String(item.sku)];
      if (!product) return;

      // накопить количество по SKU
      if (!seller.products_sold[item.sku]) seller.products_sold[item.sku] = 0;
      seller.products_sold[item.sku] += Number(item.quantity || 0);

      // ДЕНЬГИ: округляем каждую позицию
      const revenueItem = round2(options.calculateRevenue(item, product));

      const costPerUnit =
        product.purchase_price ??
        product.cost_price ??
        product.prime_cost ??
        0;

      const costItem = round2(Number(costPerUnit) * Number(item.quantity || 0));

      seller.revenue = round2(seller.revenue + revenueItem);
      seller.profit  = round2(seller.profit  + (revenueItem - costItem));
    });
  });

  // sales_count = число уникальных SKU (а не строки/кол-во штук)
  sellerStats.forEach(s => {
    s.sales_count = Object.keys(s.products_sold).length;
  });

  // Ранжирование по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Бонус и топ-10
  const total = sellerStats.length;
  sellerStats.forEach((seller, index) => {
    seller.bonus = options.calculateBonus(index, total, seller);

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // Итог
  return sellerStats.map(s => ({
    seller_id: s.seller_id,
    name: s.name,
    revenue: round2(s.revenue),
    profit:  round2(s.profit),
    sales_count: s.sales_count,
    top_products: s.top_products,
    bonus: round2(s.bonus)
  }));
}

// Экспорт для Jest/Node и доступ из браузера
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateSimpleRevenue,
    calculateBonusByProfit,
    analyzeSalesData
  };
} else {
  // опционально для браузерной отладки
  window.calculateSimpleRevenue = calculateSimpleRevenue;
  window.calculateBonusByProfit = calculateBonusByProfit;
  window.analyzeSalesData = analyzeSalesData;
}
