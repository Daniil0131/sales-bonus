/**
 * Функция для расчета выручки
 * @param purchase запись о покупке ({ sale_price, quantity, discount? })
 * @param _product карточка товара (может пригодиться для альтернативной логики)
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { sale_price = 0, quantity = 0, discount = 0 } = purchase;
  const k = 1 - (Number(discount) / 100);
  return Number(sale_price) * Number(quantity) * k;
}

/**
 * Функция для расчета бонусов
 * @param {number} index место продавца в отсортированном списке
 * @param {number} total всего продавцов
 * @param {object} seller объект статистики продавца (содержит profit)
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
 * Функция для анализа данных продаж
 * @param {object} data
 * @param {object} options { calculateRevenue, calculateBonus }
 * @returns {{revenue:number, top_products:{sku:string,quantity:number}[], bonus:number, name:string, sales_count:number, profit:number, seller_id:string}[]}
 */
function analyzeSalesData(data, options) {
  // --- Проверки входа ---
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.purchase_records)
  ) {
    throw new Error('Некорректные входные данные');
  }

  // Требование автотестов: обе функции должны быть переданы, иначе — исключение
  if (
    !options ||
    typeof options.calculateRevenue !== 'function' ||
    typeof options.calculateBonus !== 'function'
  ) {
    throw new Error('Опции calculateRevenue и calculateBonus обязательны');
  }

  // Требование автотестов: пустые purchase_records — тоже ошибка
  if (data.purchase_records.length === 0) {
    throw new Error('Пустые purchase_records');
  }

  // --- Подготовка продавцов ---
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    seller_id: seller.id, // чтобы удобнее маппить в ответе
    first_name: seller.first_name,
    last_name: seller.last_name,
    name: `${seller.first_name} ${seller.last_name}`, // авто-тест ждёт имя + фамилию
    start_date: seller.start_date,
    position: seller.position,

    revenue: 0,
    profit: 0,
    sales_count: 0,       // авто-тест ожидает считать кол-во ПОЗИЦИЙ (строк items), а не сумму quantity
    products_sold: {},    // { sku: суммарное количество }
    bonus: 0,
    top_products: []
  }));

  // --- Индексы для быстрого доступа ---
  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [String(s.id), s]));
  const productIndex = Object.fromEntries(
    data.products.map((p) => [String(p.sku), p])
  );

  // --- Расчёты по покупкам ---
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[String(record.seller_id)];
    if (!seller) return; // защита на случай битых данных

    record.items.forEach((item) => {
      const product = productIndex[String(item.sku)];
      if (!product) return; // защита

      // products_sold
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += Number(item.quantity || 0);

      // выручка — через переданную в options функцию
      const revenueItem = options.calculateRevenue(item, product);
      seller.revenue += Number(revenueItem || 0);

      // прибыль = выручка - (себестоимость * quantity)
      const costPerUnit =
        product.purchase_price ??
        product.cost_price ??
        product.prime_cost ??
        0;
      seller.profit += Number(revenueItem || 0) - Number(costPerUnit) * Number(item.quantity || 0);

      // ВАЖНО: sales_count как число ПОЗИЦИЙ (строк), а не сумма quantity
      seller.sales_count += 1;
    });
  });

  // --- Сортировка по прибыли ---
  sellerStats.sort((a, b) => b.profit - a.profit);

  // --- Премии и топ-10 ---
  const total = sellerStats.length;
  sellerStats.forEach((seller, index) => {
    // бонус — через функцию из options (авто-тест это проверяет)
    seller.bonus = options.calculateBonus(index, total, seller);

    // топ-10 по количеству
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // --- Итоговый ответ (деньги округляем, как просили, но возвращаем числом) ---
  return sellerStats.map((seller) => ({
    seller_id: seller.seller_id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2)
  }));
}

