import React, { useMemo } from 'react';
import { CalculatedProduct, MarkupTiers } from '../types';
import { Tag, Barcode, TrendingDown, Building2, ShoppingBag, Package } from 'lucide-react';
import { useTheme } from '../theme';
import { getPackCount } from '../utils/pricing';

interface CardViewProps {
  products: CalculatedProduct[];
  markupTiers: MarkupTiers;
  groupByBrand?: boolean;
  currencySymbol?: string;
}

export const CardView: React.FC<CardViewProps> = ({
  products,
  markupTiers,
  groupByBrand = false,
  currencySymbol = '$',
}) => {
  const { currentTheme } = useTheme();

  const groupedProducts = useMemo(() => {
    if (!groupByBrand) return null;
    const groups: { [brand: string]: CalculatedProduct[] } = {};
    products.forEach((p) => {
      if (!groups[p.brand]) groups[p.brand] = [];
      groups[p.brand].push(p);
    });
    return groups;
  }, [products, groupByBrand]);

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-slate-400" />
        <h3 className="mt-3 text-sm font-bold text-slate-900">No products found</h3>
        <p className="mt-1 text-xs text-slate-500">
          Try adjusting your search query, brand checkboxes, or category filter above.
        </p>
      </div>
    );
  }

  const renderCard = (product: CalculatedProduct) => {
    const trax = product.suppliers.find((s) => s.name === 'Trax');
    const campbells = product.suppliers.find((s) => s.name === 'Campbells');
    const oneDist = product.suppliers.find((s) => s.name === 'One Distribution');
    const packCount = getPackCount(product.master_pack_size, product.product_type, product.product_name);

    const getPriceFontClass = (rank?: string) => {
      if (rank === 'lowest') return 'text-emerald-600 font-bold';
      if (rank === 'highest') return 'text-rose-600 font-bold';
      return 'text-blue-600 font-semibold';
    };

    const getRankLabel = (rank?: string) => {
      if (rank === 'lowest') return 'Lowest Quote';
      if (rank === 'highest') return 'Highest';
      return 'Mid Quote';
    };

    const getRankBadgeClass = (rank?: string) => {
      if (rank === 'lowest') return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
      if (rank === 'highest') return 'bg-rose-50 text-rose-700 border border-rose-200/60';
      return 'bg-blue-50 text-blue-700 border border-blue-200/60';
    };

    return (
      <div
        key={product.id}
        id={`product-card-${product.id}`}
        className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow duration-150"
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide uppercase ${currentTheme.classes.brandBadge}`}
              >
                <Tag className="h-2.5 w-2.5 opacity-80" />
                {product.brand}
              </span>

              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 border border-slate-200/60">
                {product.retail_code}
              </span>

              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-500 border border-slate-200/50">
                <Barcode className="h-3 w-3 text-slate-400" />
                {product.gtin}
              </span>
            </div>

            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                product.category === 'Cigarettes'
                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
              }`}
            >
              {product.category}
            </span>
          </div>

          <h3 className="mt-3 text-sm font-bold text-slate-900 leading-snug">{product.product_name}</h3>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
              <Package className="h-3 w-3 text-slate-500" />
              Master:{' '}
              {product.master_pack_size || (product.product_type === 'Cigarettes' ? '10 Packs' : '5 Pouches')}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 font-medium">{product.product_type || product.category}</span>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              <TrendingDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span className="font-medium">Wholesale Spread:</span>
            </div>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-xs font-bold text-slate-900">
                {currencySymbol}
                {product.spread.toFixed(2)}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">({product.spread_percent}%)</span>
              <span className="text-[10px] text-emerald-700 font-medium">Best: {product.cheapest_supplier}</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                Supplier Price Quotes
              </span>
              <span className="text-[10px] text-slate-400">Master Carton &amp; Individual Unit Cost</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Trax', code: product.trax_code, price: product.trax_price, rank: trax?.rank },
                {
                  label: 'Campbells',
                  code: product.campbells_code,
                  price: product.campbells_price,
                  rank: campbells?.rank,
                },
                {
                  label: 'One Dist',
                  code: product.onedistribution_code,
                  price: product.onedistribution_price,
                  rank: oneDist?.rank,
                },
              ].map((sup) => (
                <div
                  key={sup.label}
                  className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 text-center flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[10px] font-medium text-slate-500">{sup.label}</div>
                    <div className="font-mono text-[9.5px] text-slate-400">{sup.code}</div>
                    <div
                      className={`mt-1 font-mono text-base tracking-tight ${getPriceFontClass(sup.rank)}`}
                      title={`${sup.label} Master Wholesale Price: ${currencySymbol}${sup.price.toFixed(2)}`}
                    >
                      {currencySymbol}
                      {sup.price.toFixed(2)}
                    </div>

                    <div
                      className="mt-1 rounded bg-white/90 px-1 py-1 border border-slate-200/60 shadow-2xs"
                      title={`${currencySymbol}${sup.price.toFixed(2)} ÷ ${packCount} = ${currencySymbol}${(
                        sup.price / packCount
                      ).toFixed(2)} individual product cost`}
                    >
                      <div className="text-[11px] font-mono font-bold text-slate-800 leading-tight">
                        {currencySymbol}
                        {(sup.price / packCount).toFixed(2)}
                        <span className="text-[8.5px] font-medium text-slate-500"> / ea</span>
                      </div>
                      {packCount > 1 ? (
                        <div className="text-[8.5px] text-slate-400 font-mono leading-none mt-0.5">
                          {sup.price.toFixed(2)} ÷ {packCount}
                        </div>
                      ) : (
                        <div className="text-[8.5px] text-slate-400 font-mono leading-none mt-0.5">single unit</div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`inline-block mt-2 rounded px-1.5 py-0.2 text-[9px] font-bold ${getRankBadgeClass(
                      sup.rank
                    )}`}
                  >
                    {getRankLabel(sup.rank)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-2">
            <span className="flex items-center gap-1 text-slate-800">Estimated Retail Tiers (POS Reference)</span>
            <span className="font-mono text-[10px] text-slate-500">
              Max Cost: {currencySymbol}
              {product.highest_cost.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              {
                name: 'Tier 1',
                pct: markupTiers.tier1,
                rounded: markupTiers.round_tier1,
                value: product.retail_tier1,
                sub: 'POS Default',
              },
              {
                name: 'Tier 2',
                pct: markupTiers.tier2,
                rounded: markupTiers.round_tier2,
                value: product.retail_tier2,
                sub: 'Member Pricing',
              },
              {
                name: 'Tier 3',
                pct: markupTiers.tier3,
                rounded: markupTiers.round_tier3,
                value: product.retail_tier3,
                sub: 'Floor Margin',
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className="rounded-md border border-slate-200 bg-white p-2 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-700 uppercase">
                    <span>
                      {tier.name} (+{tier.pct}%)
                    </span>
                    {tier.rounded && (
                      <span
                        className="rounded bg-indigo-50 text-indigo-700 px-1 py-0.1 text-[8.5px] font-mono font-bold border border-indigo-200/60"
                        title="Rounded figure active"
                      >
                        Rnd
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-extrabold text-slate-900">
                    {currencySymbol}
                    {tier.value.toFixed(2)}
                  </div>
                  {packCount > 1 && (
                    <div
                      className="text-[9.5px] font-mono text-slate-500 font-medium leading-tight mt-0.5"
                      title="Individual unit retail reference"
                    >
                      {currencySymbol}
                      {(tier.value / packCount).toFixed(2)}{' '}
                      <span className="text-[8px] text-slate-400">/ pk</span>
                    </div>
                  )}
                </div>
                <div className="text-[8.5px] text-slate-400 mt-1">{tier.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (groupedProducts) {
    return (
      <div className="space-y-8" id="wholesale-grouped-card-view">
        {(Object.entries(groupedProducts) as [string, CalculatedProduct[]][]).map(([brandName, brandItems]) => (
          <div key={`brand-group-${brandName}`} className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${currentTheme.classes.brandBadge}`}
                >
                  <Tag className="h-3 w-3 opacity-80" />
                  {brandName}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {brandItems.length} {brandItems.length === 1 ? 'Product' : 'Products'}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Avg Spread: {currencySymbol}
                {(brandItems.reduce((acc, c) => acc + c.spread, 0) / brandItems.length).toFixed(2)}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {brandItems.map((product) => renderCard(product))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" id="wholesale-card-grid">
      {products.map((product) => renderCard(product))}
    </div>
  );
};
