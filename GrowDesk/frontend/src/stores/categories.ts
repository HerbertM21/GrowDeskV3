import { defineStore } from 'pinia'
import { ref } from 'vue'
import apiClient from '@/services/apiClient'

export interface Category {
  id: string  // Cambio de number a string para coincidir con el backend
  name: string
  description: string
  color?: string
  icon?: string
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

// Nombre clave para localStorage
const STORAGE_KEY = 'growdesk-categories'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])
  const loading = ref(false)
  const error = ref('')

  // Categorías de ejemplo (mock)
  const mockCategories: Category[] = [
    { id: '1', name: 'Soporte Técnico', description: 'Problemas técnicos y asistencia' },
    { id: '2', name: 'Ventas', description: 'Consultas sobre productos y servicios' },
    { id: '3', name: 'Facturación', description: 'Problemas con pagos y facturas' },
    { id: '4', name: 'General', description: 'Consultas generales' }
  ]

  // Guardar categorías en localStorage
  function saveCategoriesToLocalStorage() {
    console.log('Guardando categorías en localStorage:', categories.value)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories.value))
  }

  // Cargar categorías desde localStorage
  function loadCategoriesFromLocalStorage(): Category[] {
    try {
      // Limpiar datos potencialmente inválidos
      import('@/utils/validators').then(({ filterValidCategories }) => {
        try {
          const data = localStorage.getItem(STORAGE_KEY);
          if (data) {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              const valid = filterValidCategories(parsed);
              if (valid.length !== parsed.length) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
                console.warn(`Se limpiaron ${parsed.length - valid.length} categorías inválidas`);
              }
            }
          }
        } catch (e) {
          console.error('Error al limpiar categorías:', e);
        }
      }).catch(e => console.error('Error al importar utilidades:', e));
      
      const storedData = localStorage.getItem(STORAGE_KEY)
      if (storedData) {
        console.log('Categorías cargadas desde localStorage')
        const parsed = JSON.parse(storedData);
        // Verificar que es un array válido
        if (!Array.isArray(parsed)) {
          console.error('Datos de categorías no son un array válido');
          return [];
        }
        // Filtrar para asegurar que solo tenemos objetos válidos
        const validCategories = parsed.filter(item => 
          typeof item === 'object' && 
          item !== null && 
          'id' in item && 
          'name' in item
        );
        if (validCategories.length !== parsed.length) {
          console.warn(`Se filtraron ${parsed.length - validCategories.length} categorías inválidas`);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validCategories));
        }
        return validCategories;
      }
    } catch (err) {
      console.error('Error al cargar categorías desde localStorage:', err)
    }
    console.log('No se encontraron categorías en localStorage, usando datos iniciales')
    return []
  }

  // Inicializar el store
  function initializeStore() {
    // Intentar cargar desde localStorage primero
    const storedCategories = loadCategoriesFromLocalStorage()
    
    // Si no hay categorías almacenadas, usar las categorías de ejemplo
    if (storedCategories.length === 0) {
      categories.value = [...mockCategories]
      // Guardar las categorías iniciales en localStorage
      saveCategoriesToLocalStorage()
    } else {
      categories.value = storedCategories
    }
  }

  // Cargar categorías desde el backend
  async function fetchCategories() {
    loading.value = true
    error.value = ''
    
    try {
      console.log('Cargando categorías desde el backend...')
      const response = await apiClient.get('/api/categories')
      categories.value = response.data
      console.log('Categorías cargadas desde el backend:', categories.value)
    } catch (err: any) {
      console.error('Error al cargar categorías desde el backend:', err)
      error.value = 'Error al cargar las categorías'
      
      // Fallback: usar categorías por defecto si falla la conexión
      categories.value = [
        { 
          id: 'default-1', 
          name: 'Soporte Técnico', 
          description: 'Problemas técnicos y asistencia',
          color: '#4CAF50',
          icon: 'computer',
          active: true
        },
        { 
          id: 'default-2', 
          name: 'Consultas Generales', 
          description: 'Consultas y preguntas generales',
          color: '#2196F3',
          icon: 'help',
          active: true
        },
        { 
          id: 'default-3', 
          name: 'Facturación', 
          description: 'Problemas con pagos y facturas',
          color: '#FFC107',
          icon: 'credit_card',
          active: true
        }
      ]
    } finally {
      loading.value = false
    }
  }

  // Añadir una categoría
  async function addCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) {
    loading.value = true
    error.value = ''
    
    try {
      console.log('Creando nueva categoría:', category)
      const response = await apiClient.post('/api/categories', {
        name: category.name,
        description: category.description,
        color: category.color || '#3498db',
        icon: category.icon || 'category',
        active: category.active !== false
      })
      
      const newCategory = response.data
      categories.value.push(newCategory)
      console.log('Categoría creada exitosamente:', newCategory)
      
      return newCategory
    } catch (err: any) {
      console.error('Error al crear categoría:', err)
      error.value = 'Error al crear la categoría'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Actualizar una categoría
  async function updateCategory(category: Category) {
    loading.value = true
    error.value = ''
    
    try {
      console.log('Actualizando categoría:', category)
      const response = await apiClient.put(`/api/categories/${category.id}`, {
        name: category.name,
        description: category.description,
        color: category.color,
        icon: category.icon,
        active: category.active
      })
      
      const updatedCategory = response.data
      const index = categories.value.findIndex((c: Category) => c.id === category.id)
      if (index !== -1) {
        categories.value[index] = updatedCategory
      }
      console.log('Categoría actualizada exitosamente:', updatedCategory)
      
      return updatedCategory
    } catch (err: any) {
      console.error('Error al actualizar categoría:', err)
      error.value = 'Error al actualizar la categoría'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Eliminar una categoría
  async function deleteCategory(id: string) {  // Cambio de number a string
    loading.value = true
    error.value = ''
    
    try {
      console.log('Eliminando categoría con ID:', id)
      await apiClient.delete(`/api/categories/${id}`)
      
      // Filtrar categorías y actualizar el estado
      categories.value = categories.value.filter((c: Category) => c.id !== id)
      console.log('Categoría eliminada exitosamente')
    } catch (err: any) {
      console.error('Error al eliminar categoría:', err)
      error.value = 'Error al eliminar la categoría'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Inicializar automáticamente el store al importarlo
  initializeStore()

  return {
    categories,
    loading,
    error,
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    initializeStore
  }
}) 