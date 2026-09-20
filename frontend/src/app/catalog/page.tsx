'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Product, ProductCategory, ProductFormData } from '@/types/crm';
import { 
  fetchProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} from '@/lib/api';
import { 
  Boxes, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  AlertTriangle,
  Loader2,
  CheckCircle,
  Tag,
  Truck,
  Layers,
  Wrench
} from 'lucide-react';

const CATEGORIES: { label: string; value: ProductCategory | 'all'; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Todos los Rubros', value: 'all', icon: Boxes },
  { label: 'Aglomerantes', value: 'Aglomerantes', icon: Layers },
  { label: 'Áridos', value: 'Áridos', icon: Boxes },
  { label: 'Hierros y Aceros', value: 'Hierros y Aceros', icon: Wrench },
  { label: 'Mampostería', value: 'Mampostería', icon: Boxes },
  { label: 'Techos e Hidráulica', value: 'Techos e Hidráulica', icon: Layers },
  { label: 'Servicios y Fletes', value: 'Servicios', icon: Truck },
];

const CATEGORY_COLORS: Record<ProductCategory, { bg: string; text: string; border: string }> = {
  'Aglomerantes': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Áridos': { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  'Hierros y Aceros': { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
  'Mampostería': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Techos e Hidráulica': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Servicios': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

function formatARS(amount: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<ProductFormData>({
    code: '',
    name: '',
    category: 'Aglomerantes',
    unit: 'bolsa 50kg',
    unit_price: 0,
    description: '',
    is_active: true,
  });

  const loadCatalog = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar catálogo');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchProducts()
      .then((data) => {
        if (isMounted) setProducts(data);
      })
      .catch((err: unknown) => {
        if (isMounted) setErrorMsg(err instanceof Error ? err.message : 'Error al cargar catálogo');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesSearch = 
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (prod.description && prod.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'all' || prod.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      code: '',
      name: '',
      category: 'Aglomerantes',
      unit: 'bolsa 50kg',
      unit_price: 0,
      description: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      code: p.code,
      name: p.name,
      category: p.category,
      unit: p.unit,
      unit_price: Number(p.unit_price),
      description: p.description || '',
      is_active: p.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
        setSuccessMsg('Material actualizado con éxito');
      } else {
        await createProduct(formData);
        setSuccessMsg('Nuevo material incorporado al catálogo');
      }
      setIsModalOpen(false);
      await loadCatalog();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar material');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    setIsSubmitting(true);
    try {
      await deleteProduct(deletingProduct.id);
      setSuccessMsg(`Material "${deletingProduct.name}" dado de baja (baja lógica).`);
      setDeletingProduct(null);
      await loadCatalog();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al dar de baja material');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="w-7 h-7 text-blue-600" />
              Catálogo de Materiales y Servicios
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Lista de materiales de construcción y fletes de referencia para la elaboración de presupuestos.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Nuevo Material
          </button>
        </div>

        {/* Notificaciones */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            {errorMsg}
          </div>
        )}

        {/* Categorías (Pestañas) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs scale-102'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Barra de Búsqueda y Conteo */}
        <div className="flex items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código (ej. CEM-50) o descripción de material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">
            {filteredProducts.length} materiales en catálogo
          </span>
        </div>

        {/* Grilla / Listado de Materiales */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2 bg-white rounded-xl border border-slate-200">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm">Cargando catálogo de materiales...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2 bg-white rounded-xl border border-slate-200">
            <Boxes className="w-10 h-10 text-slate-300" />
            <p className="font-semibold text-slate-700">No se encontraron materiales</p>
            <p className="text-xs text-slate-400">Prueba con otro rubro o busca por otra palabra clave.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((prod) => {
              const catStyle = CATEGORY_COLORS[prod.category] || CATEGORY_COLORS['Aglomerantes'];
              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-2xs hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {prod.code}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                        {prod.category}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm mt-2.5 leading-snug">
                      {prod.name}
                    </h3>
                    {prod.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {prod.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Precio estimado</div>
                      <div className="text-base font-black text-slate-900">
                        {formatARS(Number(prod.unit_price))}
                        <span className="text-xs font-normal text-slate-500 ml-1">/ {prod.unit}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(prod)}
                        title="Modificar precio o datos"
                        className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingProduct(prod)}
                        title="Dar de baja"
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE ALTA / EDICIÓN DE MATERIAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" />
                {editingProduct ? 'Modificar Material' : 'Agregar Material al Catálogo'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Código de Artículo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. CEM-50, HIE-10"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Rubro / Categoría *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="Aglomerantes">Aglomerantes</option>
                    <option value="Áridos">Áridos</option>
                    <option value="Hierros y Aceros">Hierros y Aceros</option>
                    <option value="Mampostería">Mampostería</option>
                    <option value="Techos e Hidráulica">Techos e Hidráulica</option>
                    <option value="Servicios">Servicios y Fletes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Descripción Comercial del Material *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Cemento Portland Loma Negra 50 kg"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Unidad de Medida *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="bolsa 50kg, m3, barra 12m"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Precio de Referencia ($ ARS) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="9800.00"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Detalles o Recomendaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Instrucciones de almacenamiento o aplicación recomendada..."
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingProduct ? 'Actualizar Material' : 'Guardar Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE BAJA LÓGICA */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">¿Dar de baja este material?</h3>
              <p className="text-sm font-semibold text-slate-800 mt-1">{deletingProduct.name}</p>
              <p className="text-xs text-slate-500 mt-2">
                Se aplicará <strong>baja lógica</strong>: el material no aparecerá en nuevas cotizaciones pero se preservará su historial en presupuestos ya emitidos.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar Baja
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
