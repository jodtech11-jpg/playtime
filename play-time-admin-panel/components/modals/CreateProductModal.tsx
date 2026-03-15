import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { useVenues } from '../../hooks/useVenues';
import { useCategories } from '../../hooks/useCategories';
import { formatCurrency } from '../../utils/formatUtils';
import ImageUpload from '../shared/ImageUpload';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  editingProduct?: Product | null;
}

const CreateProductModal: React.FC<CreateProductModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  editingProduct
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [originalPrice, setOriginalPrice] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [stock, setStock] = useState<string>('');
  const [minStock, setMinStock] = useState<string>('');
  const [sku, setSku] = useState('');
  const [venueId, setVenueId] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [tags, setTags] = useState<string>('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { venues } = useVenues({ realtime: false });
  const { categories } = useCategories({ activeOnly: true, realtime: false });

  // Populate form when editing
  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setDescription(editingProduct.description || '');
      setCategory(editingProduct.category);
      setPrice(editingProduct.price.toString());
      setOriginalPrice(editingProduct.originalPrice?.toString() || '');
      setDiscount(editingProduct.discount?.toString() || '');
      setStock(editingProduct.stock.toString());
      setMinStock(editingProduct.minStock?.toString() || '');
      setSku(editingProduct.sku || '');
      setVenueId(editingProduct.venueId || '');
      setImageUrls(editingProduct.images || []);
      setTags(editingProduct.tags?.join(', ') || '');
      setIsFeatured(editingProduct.isFeatured || false);
    } else {
      // Reset form for new product
      setName('');
      setDescription('');
      setCategory('');
      setPrice('');
      setOriginalPrice('');
      setDiscount('');
      setStock('');
      setMinStock('');
      setSku('');
      setVenueId('');
      setImageUrls([]);
      setTags('');
      setIsFeatured(false);
    }
    setError(null);
  }, [editingProduct, isOpen]);

  // Calculate status based on stock
  const calculatedStatus = useMemo(() => {
    const stockNum = parseInt(stock) || 0;
    if (stockNum === 0) return 'Out of Stock';
    if (stockNum < 10) return 'Low Stock';
    return 'In Stock';
  }, [stock]);

  const selectedVenue = useMemo(() => {
    return venues.find(v => v.id === venueId);
  }, [venues, venueId]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!name.trim()) {
        throw new Error('Product name is required');
      }

      if (!category) {
        throw new Error('Please select a category');
      }

      if (!price || parseFloat(price) <= 0) {
        throw new Error('Price must be greater than 0');
      }

      if (stock === '' || parseInt(stock) < 0) {
        throw new Error('Stock must be 0 or greater');
      }

      if (imageUrls.length === 0) {
        throw new Error('At least one image is required');
      }

      const priceNum = parseFloat(price);
      const originalPriceNum = originalPrice ? parseFloat(originalPrice) : undefined;
      const discountNum = discount ? parseFloat(discount) : undefined;
      
      // Calculate discount if original price is provided
      let finalPrice = priceNum;
      let finalDiscount = discountNum;
      if (originalPriceNum && originalPriceNum > priceNum) {
        finalDiscount = Math.round(((originalPriceNum - priceNum) / originalPriceNum) * 100);
      } else if (discountNum && discountNum > 0 && discountNum <= 100) {
        finalPrice = originalPriceNum ? originalPriceNum * (1 - discountNum / 100) : priceNum;
      }

      const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        price: finalPrice,
        originalPrice: originalPriceNum && originalPriceNum > finalPrice ? originalPriceNum : undefined,
        discount: finalDiscount && finalDiscount > 0 ? finalDiscount : undefined,
        stock: parseInt(stock) || 0,
        minStock: minStock ? parseInt(minStock) : undefined,
        images: imageUrls,
        status: calculatedStatus,
        sku: sku.trim() || undefined,
        venueId: venueId || undefined,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(t => t) : undefined,
        isFeatured: isFeatured || undefined
      };

      await onCreate(productData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-2xl font-black text-gray-900">
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Product Name */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Product Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Professional Badminton Racket"
                required
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Product description..."
                rows={3}
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={categories.length === 0}
              >
                <option value="">{categories.length === 0 ? 'No categories available' : 'Select a category'}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {categories.length === 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800 font-medium mb-1">
                    No categories found. Please create categories first.
                  </p>
                  <p className="text-xs text-amber-700">
                    Click the "Manage" button next to the category filter in the Marketplace to create categories.
                  </p>
                </div>
              )}
            </div>

            {/* SKU */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                SKU (Optional)
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., PRO-RACKET-001"
              />
            </div>

            {/* Original Price (for discounts) */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Original Price (₹) <span className="text-gray-300">(Optional - for discounts)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0.00"
              />
            </div>

            {/* Discount */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Discount (%) <span className="text-gray-300">(Optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0"
              />
            </div>

            {/* Price */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Selling Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0.00"
                required
              />
              {price && (
                <p className="text-sm text-gray-500 mt-1">
                  {formatCurrency(parseFloat(price) || 0)}
                  {originalPrice && parseFloat(originalPrice) > parseFloat(price) && (
                    <span className="text-red-600 ml-2">
                      (Save {formatCurrency(parseFloat(originalPrice) - parseFloat(price))})
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Stock */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Stock Quantity *
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0"
                required
              />
              {stock && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Status: <span className="font-bold">{calculatedStatus}</span></p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        calculatedStatus === 'Out of Stock' ? 'bg-red-500 w-0' :
                        calculatedStatus === 'Low Stock' ? 'bg-amber-500' : 'bg-primary'
                      }`}
                      style={{ 
                        width: calculatedStatus === 'Out of Stock' ? '0%' :
                               calculatedStatus === 'Low Stock' ? '30%' : '100%'
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Min Stock (Reorder Point) */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Min Stock (Reorder Point) <span className="text-gray-300">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="10"
              />
              <p className="text-xs text-gray-500 mt-1">Alert when stock falls below this level</p>
            </div>

            {/* Venue (Optional) */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Venue (Optional - Leave empty for global product)
              </label>
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Global Product (All Venues)</option>
                {venues.map(venue => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Tags <span className="text-gray-300">(Optional - comma separated)</span>
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., premium, bestseller, new"
              />
              <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
            </div>

            {/* Featured Product */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-5 h-5 text-primary rounded focus:ring-primary"
                />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Featured Product
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">Show this product prominently in listings</p>
            </div>

            {/* Images */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Images * (At least one required)
              </label>
              <ImageUpload
                value={imageUrls}
                onChange={setImageUrls}
                folder="products"
                itemId={editingProduct?.id}
                maxImages={10}
                maxSizeMB={5}
                compress={true}
                multiple={true}
                disabled={loading}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProductModal;

