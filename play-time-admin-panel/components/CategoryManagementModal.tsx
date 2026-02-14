import React, { useState, useEffect } from 'react';
import { Category } from '../types';
import { categoriesCollection } from '../services/firebase';
import { serverTimestamp } from 'firebase/firestore';

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onUpdate: () => void;
}

const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  isOpen,
  onClose,
  categories,
  onUpdate
}) => {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#10b981'); // Default green
  const [order, setOrder] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name);
      setDescription(editingCategory.description || '');
      setIcon(editingCategory.icon || '');
      setColor(editingCategory.color || '#10b981');
      setOrder(editingCategory.order?.toString() || '');
      setIsActive(editingCategory.isActive);
    } else {
      resetForm();
    }
    setError(null);
  }, [editingCategory]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setIcon('');
    setColor('#10b981');
    setOrder('');
    setIsActive(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!name.trim()) {
        throw new Error('Category name is required');
      }

      const categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        color: color,
        order: order ? parseInt(order) : undefined,
        isActive
      };

      if (editingCategory) {
        await categoriesCollection.update(editingCategory.id, {
          ...categoryData,
          updatedAt: serverTimestamp()
        });
      } else {
        await categoriesCollection.create({
          ...categoryData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      resetForm();
      setEditingCategory(null);
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? Products using this category will need to be updated.')) {
      return;
    }

    try {
      setProcessing(categoryId);
      await categoriesCollection.delete(categoryId);
      onUpdate();
    } catch (err: any) {
      alert('Failed to delete category: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      setProcessing(category.id);
      await categoriesCollection.update(category.id, {
        isActive: !category.isActive,
        updatedAt: serverTimestamp()
      });
      onUpdate();
    } catch (err: any) {
      alert('Failed to update category: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-2xl font-black text-gray-900">
            {editingCategory ? 'Edit Category' : 'Manage Categories'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Form Section */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-4">
            <h4 className="text-lg font-black text-gray-900">
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </h4>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Equipment, Rackets, Accessories"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Category description..."
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Icon (Material Symbol)
                  </label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., sports, shopping_bag"
                  />
                  {icon && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-2xl">{icon}</span>
                      <span className="text-xs text-gray-500">Preview</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-16 h-12 border border-gray-200 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="#10b981"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 text-primary rounded focus:ring-primary"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Active (visible in product creation)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                {editingCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      resetForm();
                    }}
                    className="px-6 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>

          {/* Categories List */}
          <div>
            <h4 className="text-lg font-black text-gray-900 mb-4">Existing Categories</h4>
            {categories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">category</span>
                <p>No categories found. Create your first category above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      editingCategory?.id === category.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {category.icon && (
                        <span
                          className="material-symbols-outlined text-2xl"
                          style={{ color: category.color }}
                        >
                          {category.icon}
                        </span>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="font-black text-gray-900">{category.name}</h5>
                          {!category.isActive && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-black uppercase tracking-widest rounded">
                              Inactive
                            </span>
                          )}
                          {category.order !== undefined && (
                            <span className="text-xs text-gray-400">Order: {category.order}</span>
                          )}
                        </div>
                        {category.description && (
                          <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(category)}
                        disabled={processing === category.id}
                        className={`px-3 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50 ${
                          category.isActive
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                        title={category.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {category.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleEdit(category)}
                        className="px-3 py-2 text-gray-400 hover:text-primary transition-colors"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        disabled={processing === category.id}
                        className="px-3 py-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:bg-primary-hover transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagementModal;

