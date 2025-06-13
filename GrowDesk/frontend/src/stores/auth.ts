import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
// Importar correctamente el tipo Router
import type { Router } from 'vue-router'
import type { User } from './users'
import { useUsersStore } from './users'
import router from '@/router'
import authService from '@/services/authService'

// Interfaz para el usuario autenticado
export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'assistant' | 'employee'
}

// Interfaz para el estado de autenticación
interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export const useAuthStore = defineStore('auth', () => {
  // Estado
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)
  
  // Variable para almacenar el router
  let routerInstance: typeof router = router
  
  // Getters
  const isAuthenticated = computed(() => !!token.value)
  
  const isAdmin = computed(() => {
    return user.value?.role === 'admin'
  })
  
  const isAssistant = computed(() => {
    return user.value?.role === 'assistant'
  })
  
  const isEmployee = computed(() => {
    return user.value?.role === 'employee'
  })
  
  const userFullName = computed(() => {
    return user.value ? `${user.value.firstName} ${user.value.lastName}` : ''
  })
  
  // Inicializar el estado desde localStorage
  const initFromStorage = () => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    
    if (storedToken) {
      token.value = storedToken
    }
    
    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser)
      } catch (err) {
        console.error('Error parsing user from localStorage:', err)
      }
    }
  }
  
  // Inicializar al cargar el store
  initFromStorage()
  
  // Acciones
  async function login(email: string, password: string) {
    loading.value = true;
    error.value = null;
    
    try {
      // Usar el servicio de autenticación real
      const response = await authService.login({ email, password });
        
      // Guardamos el token y el usuario
      token.value = response.token;
      user.value = response.user;
        
        // Redirigir según el rol
      if (router) {
        if (user.value && user.value.role === 'admin') {
          router.push('/dashboard');
        } else {
          router.push('/tickets');
        }
        }
        
        return true;
    } catch (err) {
      console.error('Error de login:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error de autenticación';
      error.value = errorMessage;
      return false;
    } finally {
      loading.value = false;
    }
  }
  
  function logout() {
    // Eliminar token y userId del localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    
    // Resetear el estado
    user.value = null;
    token.value = null;
    
    // Redirigir al login
    router.push('/login');
  }
  
  // Verificar si el usuario está autenticado
  async function checkAuth(): Promise<boolean> {
    const storedToken = localStorage.getItem('token');
    
    if (!storedToken) {
      user.value = null;
      token.value = null;
      return false;
    }
    
    token.value = storedToken;
    
    try {
      loading.value = true;
      
      // Cargar el perfil de usuario
      const userId = localStorage.getItem('userId');
      if (!userId) {
        throw new Error('No se pudo identificar al usuario');
      }
      
      // Usar el store de usuarios para cargar el perfil
      const usersStore = useUsersStore();
      
      // Asegurarse de que tenemos usuarios cargados
      if (usersStore.users.length === 0) {
        await usersStore.fetchUsers();
      }
      
      // Buscar el usuario por ID
      const foundUser = usersStore.users.find((u: User) => u.id.toString() === userId.toString());
      
      if (!foundUser) {
        console.error('Usuario no encontrado en el store:', userId);
        // Si estamos en desarrollo, cargar los datos mock
        if (import.meta.env.DEV) {
          usersStore.initMockUsers();
          const mockUser = usersStore.users.find((u: User) => u.id.toString() === userId.toString());
          if (mockUser) {
            user.value = { ...mockUser };
            console.log('Usuario mock cargado:', user.value);
            return true;
          }
        }
        throw new Error('Usuario no encontrado');
      }
      
      // Actualizar el usuario
      user.value = { ...foundUser };
      console.log('Usuario cargado correctamente:', user.value);
      return true;
    } catch (err) {
      console.error('Error en checkAuth:', err);
      // Si falla, limpiar token
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      token.value = null;
      user.value = null;
      return false;
    } finally {
      loading.value = false;
    }
  }
  
  // Actualizar el perfil del usuario
  async function updateProfile(profileData: Partial<User>) {
    if (!user.value) return false;
    
    try {
      loading.value = true;
      
      // Por ahora, simulamos la actualización
      
      // Actualizar los datos del usuario
      user.value = {
        ...user.value,
        ...profileData
      };
      
      return true;
    } catch (err) {
      error.value = 'Error al actualizar el perfil';
      return false;
    } finally {
      loading.value = false;
    }
  }
  
  // Cargar perfil del usuario actual
  async function fetchCurrentUserProfile() {
    if (!token.value) return null;
    
    try {
      loading.value = true;
      
      // Por ahora, obtenemos el perfil desde el store de usuarios
      const usersStore = useUsersStore();
      await usersStore.fetchUsers();
      
      // debería decodificar el token o hacer una solicitud al backend
      const userId = localStorage.getItem('userId');
      if (!userId) {
        throw new Error('No se pudo identificar al usuario');
      }
      
      const foundUser = usersStore.users.find((u: User) => u.id.toString() === userId.toString());
      
      if (!foundUser) {
        throw new Error('Usuario no encontrado');
      }
      
      user.value = { ...foundUser };
      return user.value;
    } catch (err) {
      error.value = 'Error al cargar el perfil del usuario';
      return null;
    } finally {
      loading.value = false;
    }
  }
  
  // Función para configurar el router desde el exterior
  function setRouter(r: typeof router) {
    routerInstance = r;
  }
  
  return {
    // Estado
    user,
    token,
    loading,
    error,
    
    // Getters
    isAuthenticated,
    isAdmin,
    isAssistant,
    isEmployee,
    userFullName,
    
    // Acciones
    login,
    logout,
    checkAuth,
    updateProfile,
    setRouter,
    fetchCurrentUserProfile
  }
}) 