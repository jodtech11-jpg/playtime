import React, { useState, useMemo, useEffect } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useOrders } from '../hooks/useOrders';
import { useUsers } from '../hooks/useUsers';
import { useVenues } from '../hooks/useVenues';
import { useCategories } from '../hooks/useCategories';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { productsCollection, ordersCollection } from '../services/firebase';
import { Product, Order } from '../types';
import { formatCurrency } from '../utils/formatUtils';
import { getRelativeTime } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';
import CreateProductModal from '../components/modals/CreateProductModal';
import OrderDetailsModal from '../components/modals/OrderDetailsModal';
import CategoryManagementModal from '../components/modals/CategoryManagementModal';

const Marketplace: React.FC = () => {
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  
  // State management
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('All');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('All');
  const [productStatusFilter, setProductStatusFilter] = useState<string>('All');
  const [productVenueFilter, setProductVenueFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const { products, loading: productsLoading } = useProducts({ realtime: true });
  const { orders, loading: ordersLoading } = useOrders({ realtime: true });
  const { users } = useUsers({ limit: 100 });
  const { venues } = useVenues({ realtime: false });
  const { categories, loading: categoriesLoading } = useCategories({ activeOnly: false, realtime: true });

  // Register "New Entry" handler for Header button
  useEffect(() => {
    setNewEntryHandler(() => {
      setShowCreateModal(true);
    });
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler]);

  // Get category name by ID
  const getCategoryName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : categoryId; // Fallback to ID if category not found
  };

  // Filter and search products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Category filter
    if (productCategoryFilter !== 'All') {
      filtered = filtered.filter(p => {
        // Check if product category matches filter (by ID or name for backward compatibility)
        return p.category === productCategoryFilter || getCategoryName(p.category) === productCategoryFilter;
      });
    }

    // Status filter
    if (productStatusFilter !== 'All') {
      filtered = filtered.filter(p => p.status === productStatusFilter);
    }

    // Venue filter
    if (productVenueFilter !== 'All') {
      if (productVenueFilter === 'Global') {
        filtered = filtered.filter(p => !p.venueId);
      } else {
        filtered = filtered.filter(p => p.venueId === productVenueFilter);
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [products, productCategoryFilter, productStatusFilter, productVenueFilter, searchQuery]);

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    // Payment status filter
    if (paymentStatusFilter !== 'All') {
      filtered = filtered.filter(o => o.paymentStatus === paymentStatusFilter);
    }

    // Search filter
    if (orderSearchQuery.trim()) {
      const query = orderSearchQuery.toLowerCase();
      filtered = filtered.filter(o => 
        o.orderNumber?.toLowerCase().includes(query) ||
        o.userName?.toLowerCase().includes(query) ||
        o.userEmail?.toLowerCase().includes(query) ||
        o.items.some(item => item.productName.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [orders, statusFilter, paymentStatusFilter, orderSearchQuery]);

  // Get order details with user info
  const orderDetails = useMemo(() => {
    return filteredOrders.map(order => {
      const user = users.find(u => u.id === order.userId);
      const itemsText = order.items.map(item => `${item.quantity}x ${item.productName}`).join(', ');
      
      return {
        ...order,
        userName: user?.name || order.userName || 'Unknown User',
        userInitials: (user?.name || order.userName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
        itemsText,
        statusColor: order.status === 'Pending' ? 'amber' : 
                     order.status === 'Delivered' ? 'emerald' :
                     order.status === 'Cancelled' || order.status === 'Refunded' ? 'red' : 'blue'
      };
    });
  }, [filteredOrders, users]);

  // Analytics calculations
  const analytics = useMemo(() => {
    const totalRevenue = orders
      .filter(o => o.paymentStatus === 'Paid' && o.status !== 'Refunded')
      .reduce((sum, o) => sum + o.total, 0);
    
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
    const completedOrders = orders.filter(o => o.status === 'Delivered').length;
    
    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => p.status === 'Low Stock' || p.status === 'Out of Stock').length;
    
    const topProducts = products
      .map(p => ({
        ...p,
        salesCount: p.salesCount || 0,
        revenue: p.revenue || 0
      }))
      .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
      .slice(0, 5);

    const recentOrders = orders
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      })
      .slice(0, 5);

    return {
      totalRevenue,
      totalOrders,
      pendingOrders,
      completedOrders,
      totalProducts,
      lowStockProducts,
      topProducts,
      recentOrders
    };
  }, [orders, products]);

  // Get product status color
  const getProductStatusColor = (product: Product): string => {
    if (product.status === 'Out of Stock') return 'red';
    if (product.status === 'Low Stock') return 'amber';
    return 'emerald';
  };

  // Calculate stock percentage
  const getStockPercentage = (product: Product): number => {
    const maxStock = 100; // Default max stock
    return Math.min((product.stock / maxStock) * 100, 100);
  };

  const handleCreateProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingProduct) {
      await productsCollection.update(editingProduct.id, {
        ...productData,
        updatedAt: serverTimestamp()
      });
      setEditingProduct(null);
    } else {
      await productsCollection.create({
        ...productData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowCreateModal(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      setProcessing(productId);
      await productsCollection.delete(productId);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedProducts.size} product(s)?`)) return;

    try {
      setProcessing('bulk');
      const deletePromises = Array.from(selectedProducts).map(id => 
        productsCollection.delete(id)
      );
      await Promise.all(deletePromises);
      setSelectedProducts(new Set());
    } catch (error: any) {
      console.error('Error deleting products:', error);
      alert('Failed to delete products: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: Product['status']) => {
    if (selectedProducts.size === 0) return;

    try {
      setProcessing('bulk');
      const updatePromises = Array.from(selectedProducts).map(id => 
        productsCollection.update(id, {
          status: newStatus,
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(updatePromises);
      setSelectedProducts(new Set());
    } catch (error: any) {
      console.error('Error updating products:', error);
      alert('Failed to update products: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const loading = productsLoading || ordersLoading;

  if (loading && products.length === 0 && orders.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading marketplace data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-background-light dark:bg-background-dark">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Analytics Dashboard */}
        {showAnalytics && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="material-symbols-outlined text-primary text-3xl">payments</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Revenue</span>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">{formatCurrency(analytics.totalRevenue)}</h3>
              <p className="text-xs text-gray-500 mt-1">Total sales revenue</p>
            </div>
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="material-symbols-outlined text-primary text-3xl">shopping_bag</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Orders</span>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">{analytics.totalOrders}</h3>
              <p className="text-xs text-gray-500 mt-1">{analytics.pendingOrders} pending</p>
            </div>
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="material-symbols-outlined text-primary text-3xl">inventory_2</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Products</span>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">{analytics.totalProducts}</h3>
              <p className="text-xs text-gray-500 mt-1">{analytics.lowStockProducts} low stock</p>
            </div>
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="material-symbols-outlined text-primary text-3xl">check_circle</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Completed</span>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">{analytics.completedOrders}</h3>
              <p className="text-xs text-gray-500 mt-1">Delivered orders</p>
            </div>
          </section>
        )}

        {/* Product Inventory Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-3xl">inventory_2</span>
              Product Inventory
            </h3>
            <div className="flex items-center gap-3">
              {selectedProducts.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{selectedProducts.size} selected</span>
                  <button
                    onClick={() => handleBulkStatusUpdate('In Stock')}
                    disabled={processing === 'bulk'}
                    className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-black hover:bg-emerald-600 transition-all disabled:opacity-50"
                  >
                    Mark In Stock
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate('Out of Stock')}
                    disabled={processing === 'bulk'}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-black hover:bg-red-600 transition-all disabled:opacity-50"
                  >
                    Mark Out of Stock
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={processing === 'bulk'}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-black hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              )}
              <button 
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="text-gray-400 hover:text-primary transition-colors"
                title="Toggle Analytics"
              >
                <span className="material-symbols-outlined">{showAnalytics ? 'visibility_off' : 'visibility'}</span>
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-primary hover:bg-primary-hover text-primary-content text-[11px] font-black uppercase tracking-widest py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                Add New Item
              </button>
            </div>
          </div>

          {/* Product Filters and Search */}
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products by name, SKU, category..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="All">All Categories</option>
                {categories.filter(c => c.isActive).map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-2 text-primary hover:bg-primary/10 rounded-xl text-sm font-black transition-all flex items-center gap-2"
                title="Manage Categories"
              >
                <span className="material-symbols-outlined text-lg">settings</span>
                Manage
              </button>
              <select
                value={productStatusFilter}
                onChange={(e) => setProductStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="All">All Statuses</option>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={productVenueFilter}
                onChange={(e) => setProductVenueFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="All">All Venues</option>
                <option value="Global">Global Products</option>
                {venues.map(venue => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
              {filteredProducts.length !== products.length && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setProductCategoryFilter('All');
                    setProductStatusFilter('All');
                    setProductVenueFilter('All');
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Clear Filters
                </button>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                Showing {filteredProducts.length} of {products.length} products
              </span>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">inventory_2</span>
              <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 mb-2">No Products Found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {products.length === 0 
                  ? 'Get started by adding your first product.'
                  : 'Try adjusting your filters or search query.'}
              </p>
              {products.length === 0 && (
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-primary text-primary-content rounded-xl text-sm font-black hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                >
                  Add First Product
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredProducts.map((product) => {
                const statusColor = getProductStatusColor(product);
                const stockPercentage = getStockPercentage(product);
                const primaryImage = product.images && product.images.length > 0 
                  ? product.images[0] 
                  : '';
                const isSelected = selectedProducts.has(product.id);

                return (
                  <div 
                    key={product.id} 
                    className={`bg-white dark:bg-surface-dark rounded-3xl p-5 shadow-sm border-2 transition-all group flex flex-col gap-4 ${
                      isSelected ? 'border-primary' : 'border-gray-100 dark:border-gray-700 hover:shadow-xl'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleProductSelection(product.id)}
                        className="w-5 h-5 text-primary rounded focus:ring-primary"
                      />
                      {product.isFeatured && (
                        <span className="px-2 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest rounded">
                          Featured
                        </span>
                      )}
                    </div>
                    <div className="aspect-square w-full rounded-2xl bg-gray-100 dark:bg-gray-800 overflow-hidden relative shadow-inner cursor-pointer" onClick={() => handleEditProduct(product)}>
                      {primaryImage ? (
                        <div 
                          className={`w-full h-full bg-cover bg-center group-hover:scale-110 transition-transform duration-700 ${product.status === 'Out of Stock' ? 'grayscale opacity-60' : ''}`} 
                          style={{ backgroundImage: `url(${primaryImage})` }}
                        ></div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-6xl">image</span>
                        </div>
                      )}
                      <span className={`absolute top-3 right-3 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-xl shadow-sm backdrop-blur-sm ${
                        statusColor === 'red' ? 'bg-red-50 text-red-700 border-red-100' :
                        statusColor === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {product.status}
                      </span>
                      {product.discount && product.discount > 0 && (
                        <span className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl">
                          {product.discount}% OFF
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-black text-gray-900 dark:text-gray-100 leading-tight h-10 line-clamp-2">{product.name}</h4>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{getCategoryName(product.category)}</p>
                      <div className="flex items-center justify-between pt-4">
                        <div>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <p className="text-xs text-gray-400 line-through">{formatCurrency(product.originalPrice)}</p>
                          )}
                          <span className={`text-xl font-black ${product.status === 'Out of Stock' ? 'text-gray-300' : 'text-primary'}`}>
                            {formatCurrency(product.price)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditProduct(product);
                            }}
                            className="p-2 text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                            title="Edit Product"
                          >
                            <span className="material-symbols-outlined text-xl">edit</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(product.id);
                            }}
                            disabled={processing === product.id}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                            title="Delete Product"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        </div>
                      </div>
                      <div className="w-full bg-gray-50 dark:bg-gray-700 rounded-full h-1.5 mt-4 overflow-hidden shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            statusColor === 'emerald' ? 'bg-primary' :
                            statusColor === 'amber' ? 'bg-amber-400' :
                            'bg-red-400'
                          }`} 
                          style={{ width: `${stockPercentage}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className={`text-[9px] font-black uppercase tracking-widest ${
                          statusColor === 'red' ? 'text-red-500' : 'text-gray-400'
                        }`}>
                          {product.stock} units
                        </p>
                        {(product.salesCount || 0) > 0 && (
                          <p className="text-[9px] font-black text-gray-400">
                            {product.salesCount} sold
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Orders Section */}
        <section className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm overflow-hidden mb-10">
          <div className="px-8 py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl">shopping_bag</span>
              Recent Orders
            </h3>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search orders..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <select 
                className="appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 py-2 pl-4 pr-10 rounded-xl focus:ring-primary cursor-pointer shadow-inner"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Refunded">Refunded</option>
              </select>
              <select 
                className="appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 py-2 pl-4 pr-10 rounded-xl focus:ring-primary cursor-pointer shadow-inner"
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
              >
                <option value="All">All Payment Status</option>
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Refunded">Refunded</option>
                <option value="Partially Refunded">Partially Refunded</option>
              </select>
              <button 
                onClick={() => {
                  setStatusFilter('All');
                  setPaymentStatusFilter('All');
                  setOrderSearchQuery('');
                }}
                className="text-gray-400 hover:text-primary transition-all"
                title="Clear Filters"
              >
                <span className="material-symbols-outlined">filter_alt_off</span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {orderDetails.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">shopping_bag</span>
                <p className="text-sm font-medium">No orders found</p>
                {(statusFilter !== 'All' || paymentStatusFilter !== 'All' || orderSearchQuery) && (
                  <button
                    onClick={() => {
                      setStatusFilter('All');
                      setPaymentStatusFilter('All');
                      setOrderSearchQuery('');
                    }}
                    className="mt-4 text-sm text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <th className="px-8 py-4">Order ID</th>
                    <th className="px-8 py-4">Customer</th>
                    <th className="px-8 py-4">Items</th>
                    <th className="px-8 py-4">Total</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4">Payment</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700 text-sm font-medium">
                  {orderDetails.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={() => handleOrderClick(order)}>
                      <td className="px-8 py-6 font-bold text-gray-400 font-mono text-xs">{order.orderNumber || `#${order.id.substring(0, 8).toUpperCase()}`}</td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black">
                            {order.userInitials}
                          </div>
                          <div>
                            <p className="font-black text-gray-900 dark:text-gray-100 leading-none">{order.userName}</p>
                            {order.userEmail && (
                              <p className="text-[10px] font-bold text-gray-400 mt-1">{order.userEmail}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-[10px] font-bold text-gray-400">{order.itemsText}</p>
                        <p className="text-xs text-gray-500 mt-1">{order.items.length} item(s)</p>
                      </td>
                      <td className="px-8 py-6 font-black text-gray-900 dark:text-gray-100">{formatCurrency(order.total)}</td>
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          order.statusColor === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          order.statusColor === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          order.statusColor === 'red' ? 'bg-red-50 text-red-700 border-red-100' :
                          'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          order.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          order.paymentStatus === 'Refunded' || order.paymentStatus === 'Partially Refunded' ? 'bg-red-50 text-red-700 border-red-100' :
                          'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          className="font-black text-primary uppercase text-[10px] tracking-widest cursor-pointer hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOrderClick(order);
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Create/Edit Product Modal */}
      <CreateProductModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingProduct(null);
        }}
        onCreate={handleCreateProduct}
        editingProduct={editingProduct}
      />

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onUpdate={() => {
          // Refresh orders if needed
        }}
      />

      {/* Category Management Modal */}
      <CategoryManagementModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories}
        onUpdate={() => {
          // Categories will update automatically via realtime subscription
        }}
      />
    </div>
  );
};

export default Marketplace;
