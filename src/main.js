/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции
   const {discount, sale_price, quantity} = purchase;
   
   return sale_price * quantity * (1 - discount / 100)
   
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    const {profit} = seller;
    if(index === 0) {
        return profit * 0.15;
    } else if (index === 1 || index === 2) {
        return profit * 0.10;
    } else if (index === total - 1) {
        return 0;
    } else {
        return profit * 0.05;
    }

}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {

    // @TODO: Проверка входных данных
     if (
      !data ||
      !Array.isArray(data.sellers) ||
      !Array.isArray(data.products) ||
      !Array.isArray(data.purchase_records)
    ) {
      throw new Error('Некорректные входные данные');
    }
    if (data.sellers.length === 0) {
      throw new Error('Некорректные входные данные');
    }
    if (data.products.length === 0) {
      throw new Error('Некорректные входные данные');
    }
    if (data.purchase_records.length === 0) {
      throw new Error('Пустой список операций');
    }

    // @TODO: Проверка наличия опций
    if(
        !options || 
        typeof options !== 'object' ||
        typeof options.calculateRevenue !== 'function' ||
        typeof options.calculateBonus !== 'function'
    ) {
        throw new Error('Некорректные опции')
    }
    const { calculateRevenue, calculateBonus } = options
    // @TODO: Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        first_name: seller.first_name,
        last_name: seller.last_name,
        start_date: seller.start_date,
        position: seller.position,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {},
        bonus: 0,
        top_products: []
    }))
    // @TODO: Индексация продавцов и товаров для быстрого доступа
    //const someIndex = Object.fromEntries(someArr.map(item => [item.ID, item]))
    const sellerIndex = {};
    const productIndex = {};
    sellerStats.forEach(s => { sellerIndex[String(s.id)] = s; });
    data.products.forEach(p => { productIndex[String(p.sku)] = p; });   
    // @TODO: Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
  const seller = sellerIndex[record.seller_id];
  if (!seller) return;

  // 1) Считаем продажи ПО ЧЕКАМ: +1 на каждый чек
  seller.sales_count += 1;

  // 2) Собираем уникальные SKU в рамках одного чека
  const seenSkus = new Set();

  record.items.forEach(item => {
    const skuKey = String(item.sku);
    const product = productIndex[skuKey];
    if (!product) return;

    seenSkus.add(skuKey); // учитывать SKU не более 1 раза за чек

    // Выручка и прибыль считаются по строкам (обычно так и нужно)
    const revenueItem = (typeof calculateRevenue === 'function')
      ? calculateRevenue(item, product)
      : calculateSimpleRevenue(item, product);
    seller.revenue += revenueItem;

    const unitCost = (product.cost_price ?? product.purchase_price ?? 0);
    const cost = unitCost * (item.quantity ?? 0);
    seller.profit += (revenueItem - cost);
  });

  // 3) После обработки чека — обновляем топы: +1 за чек, где встретился SKU
  seenSkus.forEach(skuKey => {
    if (!seller.products_sold[skuKey]) {
      seller.products_sold[skuKey] = 0;
    }
    seller.products_sold[skuKey] += 1;
  });
});
      

    // @TODO: Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit)
    // @TODO: Назначение премий на основе ранжирования
    const total = sellerStats.length;
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, total, seller);
        seller.top_products = Object.entries(seller.products_sold).map(([key, value]) => ({sku: key, quantity: value})).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    })
    // @TODO: Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }))
}
