import { ProductItem, MarkupTiers, CalculatedProduct, SupplierRank, ProductType } from '../types';

export function getBrand(productName: string): string {
  if (!productName) return 'UNKNOWN';
  const trimmed = productName.trim();
  const firstWord = trimmed.split(/\s+/)[0];
  return firstWord.toUpperCase();
}

export function inferProductType(productName: string, explicitType?: ProductType): ProductType {
  if (explicitType) return explicitType;
  const upper = productName.toUpperCase();
  if (
    upper.includes('30') ||
    upper.includes('POUCH') ||
    upper.includes('RYO') ||
    upper.includes('TOBACCO') ||
    upper.includes('50G')
  ) {
    return 'Tobacco Pouch (RYO)';
  }
  if (
    upper.includes('20') ||
    upper.includes('25') ||
    upper.includes('CIGARETTES') ||
    upper.includes('PACK') ||
    upper.includes('CARTON')
  ) {
    return 'Cigarettes';
  }
  return 'Other';
}

export function inferMasterPackSize(
  _productName: string,
  productType: ProductType,
  explicitSize?: string
): string {
  if (explicitSize && explicitSize.trim()) return explicitSize.trim();
  if (productType === 'Cigarettes') return '10 Packs';
  if (productType === 'Tobacco Pouch (RYO)') return '5 Pouches';
  return 'Single / 1 Unit';
}

export function getPackCount(
  masterPackSize?: string,
  productType?: ProductType,
  productName?: string
): number {
  if (masterPackSize) {
    const match = masterPackSize.match(/(\d+)/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (parsed > 0) return parsed;
    }
  }
  if (productName) {
    const ratioMatch = productName.match(/(\d+)\s*\/\s*(\d+)/);
    if (ratioMatch) {
      const pack = parseInt(ratioMatch[1], 10);
      const total = parseInt(ratioMatch[2], 10);
      if (pack > 0 && total > pack) {
        return Math.round(total / pack);
      }
    }
    const ctnMatch = productName.match(/(\d+)\s*(?:pack|pk|pouch|ct|ctn|bundle|unit)/i);
    if (ctnMatch) {
      const parsed = parseInt(ctnMatch[1], 10);
      if (parsed > 0) return parsed;
    }
  }
  if (productType === 'Cigarettes') return 10;
  if (productType === 'Tobacco Pouch (RYO)') return 5;
  return 1;
}

export function getCategory(
  productName: string,
  productType?: ProductType
): 'Cigarettes' | 'RYO / Tobacco' | 'Other' {
  const type = inferProductType(productName, productType);
  if (type === 'Cigarettes') return 'Cigarettes';
  if (type === 'Tobacco Pouch (RYO)') return 'RYO / Tobacco';
  return 'Other';
}

export function calculateProductDetails(product: ProductItem, tiers: MarkupTiers): CalculatedProduct {
  const product_type = inferProductType(product.product_name, product.product_type);
  const master_pack_size = inferMasterPackSize(product.product_name, product_type, product.master_pack_size);
  const category = getCategory(product.product_name, product_type);
  const brand =
    product.brand && product.brand.trim() ? product.brand.trim().toUpperCase() : getBrand(product.product_name);

  const suppliersRaw: { name: 'Trax' | 'Campbells' | 'One Distribution'; code: string; price: number }[] = [
    { name: 'Trax', code: product.trax_code, price: product.trax_price },
    { name: 'Campbells', code: product.campbells_code, price: product.campbells_price },
    { name: 'One Distribution', code: product.onedistribution_code, price: product.onedistribution_price },
  ];

  const sorted = [...suppliersRaw].sort((a, b) => a.price - b.price);
  const minPrice = sorted[0].price;
  const maxPrice = sorted[sorted.length - 1].price;

  const suppliers: SupplierRank[] = suppliersRaw.map((s) => {
    let rank: 'lowest' | 'middle' | 'highest' = 'middle';
    if (s.price === minPrice) {
      rank = 'lowest';
    } else if (s.price === maxPrice) {
      rank = 'highest';
    }
    return {
      ...s,
      rank,
    };
  });

  const spread = Number((maxPrice - minPrice).toFixed(2));
  const spread_percent = minPrice > 0 ? Number(((spread / minPrice) * 100).toFixed(1)) : 0;

  const cheapest_supplier = sorted[0].name;
  const highest_supplier = sorted[sorted.length - 1].name;

  let retail_tier1 = Number((maxPrice * (1 + tiers.tier1 / 100)).toFixed(2));
  let retail_tier2 = Number((maxPrice * (1 + tiers.tier2 / 100)).toFixed(2));
  let retail_tier3 = Number((maxPrice * (1 + tiers.tier3 / 100)).toFixed(2));

  if (tiers.round_tier1) retail_tier1 = Math.round(retail_tier1);
  if (tiers.round_tier2) retail_tier2 = Math.round(retail_tier2);
  if (tiers.round_tier3) retail_tier3 = Math.round(retail_tier3);

  return {
    ...product,
    brand,
    product_type,
    master_pack_size,
    highest_cost: maxPrice,
    lowest_cost: minPrice,
    spread,
    spread_percent,
    cheapest_supplier,
    highest_supplier,
    retail_tier1,
    retail_tier2,
    retail_tier3,
    suppliers,
    category,
  };
}
