import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';

interface MenuCategory {
  id: string;
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  cost_price: number;
  image_url: string;
  hsn_code: string;
  gst_rate: number;
  preparation_time: number;
  is_vegetarian: boolean;
  is_available: boolean;
  is_active: boolean;
  display_order: number;
}

export default function Menu() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    display_order: 0,
    is_active: true,
  });

  const [itemForm, setItemForm] = useState({
    category_id: '',
    name: '',
    description: '',
    price: 0,
    cost_price: 0,
    image_url: '',
    hsn_code: '',
    gst_rate: 5,
    preparation_time: 15,
    is_vegetarian: true,
    is_available: true,
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        supabase.from('menu_categories').select('*').order('display_order'),
        supabase.from('menu_items').select('*').order('display_order'),
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (itemsRes.data) setMenuItems(itemsRes.data);
    } catch (error) {
      console.error('Error loading menu data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSaveCategory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingCategory) {
        await supabase
          .from('menu_categories')
          .update(categoryForm)
          .eq('id', editingCategory.id);
      } else {
        await supabase
          .from('menu_categories')
          .insert([{ ...categoryForm, created_by: user.id }]);
      }

      setShowCategoryForm(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', display_order: 0, is_active: true });
      loadData();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category');
    }
  };

  const handleSaveItem = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingItem) {
        await supabase
          .from('menu_items')
          .update(itemForm)
          .eq('id', editingItem.id);
      } else {
        await supabase
          .from('menu_items')
          .insert([{ ...itemForm, created_by: user.id }]);
      }

      setShowItemForm(false);
      setEditingItem(null);
      setItemForm({
        category_id: '',
        name: '',
        description: '',
        price: 0,
        cost_price: 0,
        image_url: '',
        hsn_code: '',
        gst_rate: 5,
        preparation_time: 15,
        is_vegetarian: true,
        is_available: true,
        is_active: true,
        display_order: 0,
      });
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save menu item');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await supabase.from('menu_categories').delete().eq('id', id);
      loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await supabase.from('menu_items').delete().eq('id', id);
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const editCategory = (category: MenuCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description,
      display_order: category.display_order,
      is_active: category.is_active,
    });
    setShowCategoryForm(true);
  };

  const editItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      category_id: item.category_id,
      name: item.name,
      description: item.description,
      price: item.price,
      cost_price: item.cost_price,
      image_url: item.image_url,
      hsn_code: item.hsn_code,
      gst_rate: item.gst_rate,
      preparation_time: item.preparation_time,
      is_vegetarian: item.is_vegetarian,
      is_available: item.is_available,
      is_active: item.is_active,
      display_order: item.display_order,
    });
    setShowItemForm(true);
  };

  const getItemsByCategory = (categoryId: string) => {
    return menuItems.filter(item => item.category_id === categoryId);
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Menu Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </button>
          <button
            onClick={() => setShowItemForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Menu Item
          </button>
        </div>
      </div>

      {showCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Display Order</label>
                <input
                  type="number"
                  value={categoryForm.display_order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, display_order: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={categoryForm.is_active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                  className="rounded"
                />
                <label className="text-sm font-medium">Active</label>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategory(null);
                    setCategoryForm({ name: '', description: '', display_order: 0, is_active: true });
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full m-4">
            <h2 className="text-xl font-bold mb-4">
              {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
            </h2>
            <div className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={itemForm.category_id}
                  onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cost Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={itemForm.cost_price}
                  onChange={(e) => setItemForm({ ...itemForm, cost_price: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">HSN Code</label>
                <input
                  type="text"
                  value={itemForm.hsn_code}
                  onChange={(e) => setItemForm({ ...itemForm, hsn_code: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">GST Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={itemForm.gst_rate}
                  onChange={(e) => setItemForm({ ...itemForm, gst_rate: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prep Time (mins)</label>
                <input
                  type="number"
                  value={itemForm.preparation_time}
                  onChange={(e) => setItemForm({ ...itemForm, preparation_time: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Display Order</label>
                <input
                  type="number"
                  value={itemForm.display_order}
                  onChange={(e) => setItemForm({ ...itemForm, display_order: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Image URL</label>
                <input
                  type="text"
                  value={itemForm.image_url}
                  onChange={(e) => setItemForm({ ...itemForm, image_url: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="col-span-2 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={itemForm.is_vegetarian}
                    onChange={(e) => setItemForm({ ...itemForm, is_vegetarian: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Vegetarian</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={itemForm.is_available}
                    onChange={(e) => setItemForm({ ...itemForm, is_available: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Available</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={itemForm.is_active}
                    onChange={(e) => setItemForm({ ...itemForm, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => {
                  setShowItemForm(false);
                  setEditingItem(null);
                  setItemForm({
                    category_id: '',
                    name: '',
                    description: '',
                    price: 0,
                    cost_price: 0,
                    image_url: '',
                    hsn_code: '',
                    gst_rate: 5,
                    preparation_time: 15,
                    is_vegetarian: true,
                    is_available: true,
                    is_active: true,
                    display_order: 0,
                  });
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {categories.map((category) => {
          const categoryItems = getItemsByCategory(category.id);
          const isExpanded = expandedCategories.has(category.id);

          return (
            <div key={category.id} className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  <div>
                    <h3 className="font-semibold text-lg">{category.name}</h3>
                    <p className="text-sm text-gray-600">{category.description}</p>
                    <span className="text-xs text-gray-500">{categoryItems.length} items</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {category.is_active ? (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Inactive</span>
                  )}
                  <button
                    onClick={() => editCategory(category)}
                    className="text-blue-600 hover:text-blue-800 p-2"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="text-red-600 hover:text-red-800 p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4">
                  {categoryItems.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No items in this category</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryItems.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h4 className="font-semibold">{item.name}</h4>
                              <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => editItem(item)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-red-600 hover:text-red-800 p-1"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="font-bold text-lg">₹{item.price.toFixed(2)}</span>
                            <div className="flex gap-2">
                              {item.is_vegetarian && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Veg</span>
                              )}
                              {!item.is_available && (
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Unavailable</span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Prep: {item.preparation_time} mins | GST: {item.gst_rate}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
