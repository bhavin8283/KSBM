import React from 'react';
import { ProductItem } from '../types';
import { ProductFormModal } from './ProductFormModal';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (newProduct: Omit<ProductItem, 'id'>) => void;
  existingGtins?: string[];
  existingProducts?: ProductItem[];
  registeredBrands?: string[];
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onAddProduct,
  existingGtins = [],
  existingProducts = [],
  registeredBrands = [],
}) => {
  const productsForValidation =
    existingProducts.length > 0
      ? existingProducts
      : existingGtins.map((gtin, idx) => ({
          id: `mock-${idx}`,
          gtin,
          product_name: '',
          retail_code: '',
          trax_code: '',
          campbells_code: '',
          onedistribution_code: '',
          in_store: true,
          trax_price: 0,
          campbells_price: 0,
          onedistribution_price: 0,
        }));

  return (
    <ProductFormModal
      isOpen={isOpen}
      onClose={onClose}
      mode="add"
      onSave={(productData) => onAddProduct(productData)}
      existingProducts={productsForValidation}
      registeredBrands={registeredBrands}
    />
  );
};
