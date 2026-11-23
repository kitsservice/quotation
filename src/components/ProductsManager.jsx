import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  X,
  Copy,
  Boxes
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { COMMON_HSN_CODES } from '../utils/gstHelper';

const CATEGORIES = [
  'Robotics', 
  'Electrical & PLC', 
  'Mechanical Automation', 
  'Vision Systems', 
  'Software & IoT', 
  'Engineering Services',
  'Pneumatics & Hydraulics',
  'Safety & Fencing',
  'General'
];

const UNITS = ['Set', 'Nos', 'Lot', 'Meters', 'Hours', 'Mandays', 'System', 'Kg', 'Package'];

function ProductsManager({
  products = [],
  searchQuery = '',
  onSaveProduct,
  onDeleteProduct
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const initialFormState = {
    name: '',
    category: 'Robotics',
    description: '',
    hsn: '',
    unit: 'Set',
    costPrice: 0,
    unitPrice: 0,
    gstRate: 18
  };

  const [formData, setFormData] = useState(initialFormState);

  const handleOpenAdd = () => {
    setFormData(initialFormState);
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleOpenEdit = (prod) => {
    setFormData(prod);
    setEditingProduct(prod);
    setShowModal(true);
  };

  const handleDuplicate = (prod) => {
    const duplicated = {
      ...prod,
      id: 'prod-' + Date.now(),
      name: `${prod.name} (Copy)`
    };
    onSaveProduct(duplicated);
  };

  const handleHsnPresetSelect = (code) => {
    const preset = COMMON_HSN_CODES.find(h => h.code === code);
    if (preset) {
      setFormData(prev => ({
        ...prev,
        hsn: preset.code,
        gstRate: preset.defaultGst
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter item name');
      return;
    }

    onSaveProduct({
      ...formData,
      id: editingProduct?.id || 'prod-' + Date.now(),
      costPrice: parseFloat(formData.costPrice) || 0,
      unitPrice: parseFloat(formData.unitPrice) || 0,
      gstRate: parseFloat(formData.gstRate) || 18
    });

    setShowModal(false);
  };

  const filteredProducts = useMemo(() => {
    const s = (searchTerm || searchQuery || '').trim().toLowerCase();
    return products.filter(p => {
      const matchesSearch = !s ||
        (p.name || '').toLowerCase().includes(s) ||
        (p.description || '').toLowerCase().includes(s) ||
        (p.hsn || '').toLowerCase().includes(s);

      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, searchQuery, categoryFilter]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Item & Service Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain pre-configured standard robotic arms, PLC panels, vision cameras, and engineering mandays.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Add Catalog Item</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Category Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setCategoryFilter('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              categoryFilter === 'All' ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            All Items
          </button>
          {CATEGORIES.slice(0, 6).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                categoryFilter === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items, description or HSN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

      </div>

      {/* Items Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((item) => {
          const margin = item.unitPrice > 0 
            ? (((item.unitPrice - item.costPrice) / item.unitPrice) * 100).toFixed(0) 
            : 0;

          return (
            <div 
              key={item.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-medium border border-slate-200">
                    {item.category || 'General'}
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleDuplicate(item)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Duplicate Item"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Item"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteProduct(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {item.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="font-mono text-slate-400">HSN: {item.hsn || '-'}</span>
                  <span className="text-slate-600">Unit: {item.unit || 'Set'}</span>
                </div>
              </div>

              {/* Price & Margin Block */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-slate-900">
                    {formatCurrency(item.unitPrice)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Cost: {formatCurrency(item.costPrice)} • GST: {item.gstRate}%
                  </div>
                </div>

                {item.costPrice > 0 && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    margin >= 30 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {margin}% Margin
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingProduct ? 'Edit Catalog Item' : 'New Catalog Item'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure standard equipment and rates</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Item / Solution Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 6-Axis Industrial Robot Integration"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit of Measurement</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Technical Specifications & Scope</label>
                <textarea
                  rows="3"
                  placeholder="Detailed specifications, payload, reach, sensor makes, included tooling..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">HSN / SAC Code</label>
                  <input
                    type="text"
                    placeholder=""
                    value={formData.hsn}
                    onChange={(e) => setFormData({ ...formData, hsn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Common Presets */}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {COMMON_HSN_CODES.slice(0, 3).map(h => (
                      <button
                        type="button"
                        key={h.code}
                        onClick={() => handleHsnPresetSelect(h.code)}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded"
                      >
                        {h.code}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GST Rate %</label>
                  <select
                    value={formData.gstRate}
                    onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) || 18 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-amber-800 mb-1">Internal Cost Price (₹)</label>
                  <input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-amber-50/50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-blue-800 mb-1">Selling Unit Price (₹) *</label>
                  <input
                    type="number"
                    required
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20"
                >
                  Save to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default React.memo(ProductsManager);
