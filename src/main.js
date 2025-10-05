// 1) ТВОИ функции (они уже ок)
function calculateSimpleRevenue(purchase, product) {
  const sale_price = Number(purchase.sale_price ?? purchase.sale_prise ?? 0);
  const quantity   = Number(purchase.quantity ?? 0);
  const discount   = Math.max(0, Math.min(100, Number(purchase.discount ?? 0))); // защита 0..100
  const effective  = 1 - (discount / 100);
  return sale_price * quantity * effective;
}

function calculateBonusByProfit(index, total, seller) {
  const profit = Number(seller.profit || 0);
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  if (index === total - 1) return 0;
  return profit * 0.05;
}

// 2) УПРОЩЁННЫЙ анализатор (убрал double-count и лишнее)
function analyzeSalesData(data, { calculateRevenue, calculateBonus }) {
  if (!data || !Array.isArray(data.sellers) || !Array.isArray(data.products) || !Array.isArray(data.purchase_records)) {
    throw new Error('Некорректные входные данные');
  }
  if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
    throw new Error('Нужны функции calculateRevenue и calculateBonus');
  }

  const sellerStats = data.sellers.map(s => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {}
  }));

  const sellerIndex  = Object.fromEntries(sellerStats.map(s => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  for (const record of data.purchase_records) {
    const seller = sellerIndex[record.seller_id];
    if (!seller) continue;
    seller.sales_count++;

    for (const item of record.items) {
      const product = productIndex[item.sku];
      const lineRevenue = calculateRevenue(item, product);
      seller.revenue += lineRevenue;

      const sale_price = Number(item.sale_price ?? item.sale_prise ?? 0);
      const quantity   = Number(item.quantity ?? 0);
      const discount   = Math.max(0, Math.min(100, Number(item.discount ?? 0)));
      const effective  = 1 - (discount / 100);
      const cost       = (product && typeof product.cost_price === 'number') ? product.cost_price : 0;

      const lineProfit = (sale_price * effective - cost) * quantity;
      seller.profit += lineProfit;

      seller.products_sold[item.sku] = (seller.products_sold[item.sku] ?? 0) + quantity;
    }
  }

  sellerStats.sort((a, b) => b.profit - a.profit);
  const total = sellerStats.length;

  for (let i = 0; i < sellerStats.length; i++) {
    const s = sellerStats[i];
    s.bonus = calculateBonus(i, total, s);
    s.top_products = Object.entries(s.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }

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

