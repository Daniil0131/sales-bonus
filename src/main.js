/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции
   const {discount, sale_price, quantity} = purchase;
   
   return sale_price * quantity * (1- (purchase.discount / 100))
   
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
    if(!data
        
        
    ) {
        throw new Error('Неккоректные входные данные')
    }
    
    // @TODO: Проверка наличия опций
    //if (!someVar || !otherVar) {
       // throw new Error('Чего-то не хватает');
    //}
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

        record.items.forEach(item => {
            const product = productIndex[item.sku];

            if(!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;

            const revenueItem = (typeof calculateRevenue === 'function')
            ? calculateRevenue(item, product)
            : calculateSimpleRevenue(item, product);
            seller.revenue += revenueItem;

            const cost = product.cost_price ? product.cost_price * item.quantity : 0;
            seller.profit += (revenueItem - cost);

            seller.sales_count += item.quantity;
        });
        
    })
    // @TODO: Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit)
    // @TODO: Назначение премий на основе ранжирования
    const total = sellerStats.length;
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonusByProfit(index, total, seller);
        seller.top_products = Object.entries(seller.products_sold).map(([key, value]) => ({sku: key, quantity: value})).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    })
    // @TODO: Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: `${seller.first_name}`,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }))
}
