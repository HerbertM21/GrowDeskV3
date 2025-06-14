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
    console.log('Inicializando auth store desde localStorage');
    
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    const storedUserId = localStorage.getItem('userId')
    
    if (storedToken) {
      console.log('Token encontrado en localStorage');
      token.value = storedToken
    } else {
      console.log('No se encontró token en localStorage');
    }
    
    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser)
        console.log('Usuario cargado desde localStorage:', user.value);
        
        // Asegurar que el userId esté sincronizado
        if (user.value && user.value.id && !storedUserId) {
          localStorage.setItem('userId', user.value.id);
          console.log('userId sincronizado en localStorage:', user.value.id);
        }
      } catch (err) {
        console.error('Error parsing user from localStorage:', err)
      }
    } else if (storedUserId) {
      // Si no hay usuario pero sí hay userId, crear un objeto mínimo
      console.log('No hay objeto usuario completo pero sí userId:', storedUserId);
      user.value = {
        id: storedUserId,
        email: 'usuario@example.com',
        firstName: 'Usuario',
        lastName: 'Actual',
        role: 'employee',
        department: null,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
  
  // Registrar un nuevo usuario
  async function register(userData: { firstName: string, lastName: string, email: string, password: string }) {
    loading.value = true;
    error.value = null;
    
    try {
      // Usar el servicio de autenticación
      const response = await authService.register(userData);
      
      // Guardamos el token y el usuario
      token.value = response.token;
      user.value = response.user;
      
      // Redirigir al dashboard
      if (router) {
        router.push('/dashboard');
      }
      
      return true;
    } catch (err) {
      console.error('Error de registro:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error durante el registro';
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
    localStorage.removeItem('user');
    
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
      
      // Intentar cargar primero el usuario desde localStorage
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          user.value = JSON.parse(storedUser);
          console.log('Usuario cargado desde localStorage:', user.value);
          return true;
        } catch (err) {
          console.error('Error al parsear usuario de localStorage:', err);
          // No eliminar el token aquí, continuamos con el flujo normal
        }
      }
      
      // Cargar el perfil de usuario
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.warn('No se pudo identificar al usuario por ID');
        // Intentar usar el ID del usuario actual si está disponible
        if (user.value && user.value.id) {
          localStorage.setItem('userId', user.value.id);
          return true;
        }
        // Si no hay otra opción, entonces sí limpiamos
        localStorage.removeItem('token');
        token.value = null;
        user.value = null;
        return false;
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
        
        // Si ya tenemos un usuario del localStorage, usar ese en lugar de limpiar
        if (user.value) {
          console.log('Usando usuario de localStorage como fallback');
          return true;
        }
        
        console.warn('Usuario no encontrado y no hay fallback');
        return false;
      }
      
      // Actualizar el usuario
      user.value = { ...foundUser };
      console.log('Usuario cargado correctamente:', user.value);
      return true;
    } catch (err) {
      console.error('Error en checkAuth:', err);
      // No limpiar el token automáticamente si tenemos usuario en localStorage
      if (!user.value) {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        token.value = null;
        user.value = null;
      }
      return !!user.value;
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
      console.log('Obteniendo perfil de usuario actual');
      
      // Intentar obtener el perfil desde la API
      try {
        const apiResponse = await authService.checkAuth();
        if (apiResponse) {
          user.value = apiResponse;
          // Actualizar localStorage
          localStorage.setItem('user', JSON.stringify(apiResponse));
          localStorage.setItem('userId', apiResponse.id);
          console.log('Perfil de usuario actualizado desde API:', apiResponse);
          return apiResponse;
        }
      } catch (apiError) {
        console.error('Error al obtener perfil desde API:', apiError);
      }
      
      // Si falla la API, intentar obtener desde el store de usuarios
      const usersStore = useUsersStore();
      await usersStore.fetchUsers();
      
      // Intentar obtener el ID de usuario
      const userId = localStorage.getItem('userId');
      if (!userId) {
        throw new Error('No se pudo identificar al usuario');
      }
      
      const foundUser = usersStore.users.find((u: User) => u.id.toString() === userId.toString());
      
      if (!foundUser) {
        // Si no se encuentra en el store, intentar usar el usuario actual si existe
        if (user.value) {
          console.log('Usando el usuario actual como fallback');
          return user.value;
        }
        
        throw new Error('Usuario no encontrado');
      }
      
      user.value = { ...foundUser };
      // Actualizar localStorage
      localStorage.setItem('user', JSON.stringify(foundUser));
      console.log('Perfil de usuario actualizado desde store:', foundUser);
      return user.value;
    } catch (err) {
      console.error('Error al cargar el perfil del usuario:', err);
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
    fetchCurrentUserProfile,
    register
  }
}) 