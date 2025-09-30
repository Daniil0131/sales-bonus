/**
 * Функция для расчёта выручки по позиции
 * purchase: { sale_price|sale_prise, quantity, discount? }
 * product:  { ... }  // можно не использовать
 */
function calculateSimpleRevenue(purchase, product) {
  const sale_price = purchase.sale_price ?? purchase.sale_prise ?? 0;
  const quantity   = Number(purchase.quantity ?? 0);
  const discount   = Number(purchase.discount ?? 0); // в %
  const effective  = 1 - (discount / 100);

  return sale_price * quantity * effective;
}

/**
 * Функция для расчёта бонусов по месту в рейтинге (по прибыли)
 */
function calculateBonusByProfit(index, total, seller) {
  const profit = Number(seller.profit || 0);

  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  if (index === total - 1) return 0;

  return profit * 0.05;
}

/**
 * Главный анализатор
 * Ожидаемая структура data:
 * {
 *   sellers: [{id, first_name, last_name}, ...],
 *   products: [{sku, cost_price?, ...}, ...],
 *   purchase_records: [{
 *     seller_id,
 *     total_amount?,     // (необязательно) если есть — можно использовать сразу
 *     items: [{
 *       sku, sale_price|sale_prise, quantity, discount?
 *     }, ...]
 *   }, ...]
 * }
 *
 * options:
 *   { calculateRevenue: fn(purchaseItem, product), calculateBonus: fn(index, total, seller) }
 */
function analyzeSalesData(data, options) {
  // --- Валидация входа ---
  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error('Некорректные входные данные');
  }

  if (!options || typeof options !== 'object') {
    throw new Error('Не переданы опции');
  }
  const { calculateRevenue, calculateBonus } = options;
  if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
    throw new Error('В опциях должны быть функции calculateRevenue и calculateBonus');
  }

  // --- Заготовка статистики по продавцам ---
  const sellerStats = data.sellers.map(seller => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {} // sku -> quantity
  }));

  // --- Индексы для быстрого доступа ---
  const sellerIndex  = Object.fromEntries(sellerStats.map(s => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  // --- Обход чеков ---
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return; // или throw, если это критично

    seller.sales_count += 1;

    // Если есть готовая сумма по чеку — можно использовать:
    if (typeof record.total_amount === 'number') {
      seller.revenue += record.total_amount;
    }

    // В любом случае считаем по позициям (если total_amount не нужен — убери ветку выше).
    record.items.forEach(item => {
      const product = productIndex[item.sku];

      // Выручка по строке
      const lineRevenue = calculateRevenue(item, product);
      seller.revenue += lineRevenue;

      // Прибыль по строке (если известна себестоимость)
      const sale_price = item.sale_price ?? item.sale_prise ?? 0;
      const quantity   = Number(item.quantity ?? 0);
      const discount   = Number(item.discount ?? 0);
      const effective  = 1 - (discount / 100);
      const cost       = (product && typeof product.cost_price === 'number') ? product.cost_price : 0;

      const lineProfit = (sale_price * effective - cost) * quantity;
      seller.profit += lineProfit;

      // Учёт топ-товаров
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += quantity;
    });
  });

  // --- Ранжирование + бонусы (после обхода всех записей) ---
  sellerStats.sort((a, b) => b.profit - a.profit);
  const total = sellerStats.length;

  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, total, seller);

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // --- Итог ---
  return sellerStats.map(s => ({
    seller_id: s.id,
    name: s.name,
    revenue: +s.revenue.toFixed(2),
    profit: +s.profit.toFixed(2),
    sales_count: s.sales_count,
    top_products: s.top_products,
    bonus: +s.bonus.toFixed(2)
  }));
}

/* === Пример вызова ===
const result = analyzeSalesData(data, {
  calculateRevenue: calculateSimpleRevenue,
  calculateBonus: calculateBonusByProfit
});
console.log(result);
*/
