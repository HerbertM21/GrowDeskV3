import { defineStore } from 'pinia';
import apiClient from '@/api/client';
import { ref } from 'vue';

// Nombre clave para localStorage
const STORAGE_KEY = 'growdesk_users';

// Interfaces
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'assistant' | 'employee';
  department: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  // Campos adicionales de perfil
  position?: string | null;
  phone?: string | null;
  language?: string;
}

interface UsersState {
  users: User[];
  currentProfile: User | null;
  loading: boolean;
  error: string | null;
}

// Datos mock para desarrollo
const mockUsers: User[] = [
  {
    id: 'admin-123',
    email: 'admin@growdesk.com',
    firstName: 'Admin',
    lastName: 'System',
    role: 'admin',
    department: 'IT',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    position: 'Administrador del Sistema',
    phone: '+569 1234 5678',
    language: 'es'
  },
  {
    id: 'agente-growdesk',
    email: 'agente@growdesk.com',
    firstName: 'Agente',
    lastName: 'GrowDesk',
    role: 'admin',
    department: 'Soporte',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    position: 'Agente de Soporte',
    phone: '+34 600 234 567',
    language: 'es'
  },
  {
    id: 'widget-system',
    email: 'widget@system.com',
    firstName: 'Widget',
    lastName: 'System',
    role: 'admin',
    department: 'Sistema',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    position: 'Sistema Widget',
    phone: '+34 600 345 678',
    language: 'es'
  }
];

export const useUsersStore = defineStore('users', () => {
  // Estado
  const users = ref<User[]>([]);
  const currentProfile = ref<User | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  // Guardar usuarios en localStorage
  function saveUsersToLocalStorage() {
    console.log('Guardando usuarios en localStorage:', users.value);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users.value));
    
    // Sincronizar con el backend
    syncUsersWithBackend();
  }

  // Función para sincronizar los usuarios con el backend
  async function syncUsersWithBackend() {
    try {
      console.log('🔄 Iniciando sincronización con el backend');

      // Validar que el array de usuarios tenga datos válidos
      const validUsers = users.value.filter(user => 
        typeof user === 'object' && 
        user !== null &&
        'id' in user && 
        'email' in user && 
        'firstName' in user && 
        'lastName' in user && 
        'role' in user
      );
      
      if (validUsers.length !== users.value.length) {
        console.warn(`⚠️ Se filtraron ${users.value.length - validUsers.length} usuarios inválidos`);
        users.value = validUsers;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(validUsers));
      }
      
      console.log('📦 Enviando datos al servidor:', validUsers.length, 'usuarios');
      
      // Determinar la URL de sincronización - preferir la API del backend
      let apiUrl = `${import.meta.env.VITE_API_URL || ''}/api/users/sync`;
      
      // Si no hay una URL configurada, usar URL por defecto
      if (!apiUrl.includes('http')) {
        apiUrl = 'http://localhost:8080/api/users/sync';
      }
      
      console.log('🔗 URL de sincronización:', apiUrl);
      
      // Realizar la solicitud con apiClient para manejar tokens de autenticación
      const response = await apiClient.post('/users/sync', validUsers);
      
      if (response.status >= 200 && response.status < 300) {
        console.log('✅ Usuarios sincronizados correctamente:', response.data);
        
        // Si el servidor devolvió datos actualizados, actualizar el store
        if (Array.isArray(response.data)) {
          users.value = response.data;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(response.data));
          console.log('🔄 Store actualizado con datos del servidor');
        }
        
        return true;
      } else {
        throw new Error(`Error en la respuesta: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error al sincronizar usuarios con el backend:', error);
      return false;
    }
  }

  // Función para cargar usuarios desde localStorage
  function loadUsersFromLocalStorage(): User[] {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        let parsedData;
        try {
          parsedData = JSON.parse(storedData);

          // Validar que es un array
          if (!Array.isArray(parsedData)) {
            console.error('Datos en localStorage no son un array, reiniciando');
            users.value = [];
            return [];
          }

          // Filtrar elementos no válidos (404 page not found u otros strings/nulls)
          const validUsers = parsedData.filter(item => 
            typeof item === 'object' && 
            item !== null &&
            'id' in item &&
            'email' in item &&
            'firstName' in item &&
            'lastName' in item &&
            'role' in item &&
            !(typeof item === 'string' && item.includes('page not found'))
          );

          if (validUsers.length !== parsedData.length) {
            console.warn(`Se filtraron ${parsedData.length - validUsers.length} elementos inválidos del localStorage`);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(validUsers));
          }

          // Asignar únicamente usuarios válidos
          users.value = validUsers;
          console.log('Usuarios cargados desde localStorage:', validUsers.length);
          return validUsers;
        } catch (e) {
          console.error('Error al analizar localStorage, reiniciando:', e);
          users.value = [];
          localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
          return [];
        }
      } else {
        console.log('No hay usuarios en localStorage');
        users.value = [];
        return [];
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      // En caso de error, inicializar con array vacío
      users.value = [];
      return [];
    }
  }

  // Getters
  const getUsersByRole = (roleFilter: string) => {
    return users.value.filter((user: User) => user.role === roleFilter);
  };

  const getActiveUsers = () => {
    return users.value.filter((user: User) => user.active);
  };

  const getInactiveUsers = () => {
    return users.value.filter((user: User) => !user.active);
  };

  // Acciones
  const fetchUsers = async () => {
    if (loading.value) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      console.log('🔄 Obteniendo usuarios desde la API...');
      
      // Cargar directamente desde la API en lugar de localStorage primero
        try {
          const response = await apiClient.get('/users');
        
        if (Array.isArray(response.data)) {
          console.log('✅ Usuarios cargados desde API:', response.data.length);
          users.value = response.data;
          
          // Guardar en localStorage como respaldo
          localStorage.setItem(STORAGE_KEY, JSON.stringify(users.value));
        } else {
          console.error('❌ La respuesta de la API no es un array:', response.data);
          error.value = 'Formato de respuesta inválido';
          
          // Intentar cargar desde localStorage como respaldo
          const storedUsers = loadUsersFromLocalStorage();
          if (storedUsers.length > 0) {
            users.value = storedUsers;
            console.log('⚠️ Usando usuarios de localStorage como fallback:', users.value.length);
          }
        }
        } catch (apiErr) {
        console.error('❌ Error al cargar usuarios desde API:', apiErr);
        error.value = 'Error al cargar usuarios desde el servidor';
        
        // Intentar cargar desde localStorage como respaldo
        const storedUsers = loadUsersFromLocalStorage();
        if (storedUsers.length > 0) {
          users.value = storedUsers;
          console.log('⚠️ Usando usuarios de localStorage como fallback:', users.value.length);
        } else if (import.meta.env.DEV) {
          // Solo usar usuarios mock en desarrollo y si no hay datos en localStorage
          console.log('⚠️ Cargando datos mock de usuarios en modo desarrollo');
          initMockUsers();
        }
      }
    } catch (err: unknown) {
      error.value = 'Error al cargar usuarios';
      console.error('❌ Error general al cargar usuarios:', err);
    } finally {
      loading.value = false;
    }
  };

  const fetchUserProfile = async (userId: string) => {
    if (loading.value) return null;
    
    loading.value = true;
    error.value = null;
    
    try {
      console.log(`Obteniendo perfil de usuario para ID: ${userId}`);
      
      // Buscar en el array de usuarios local
      const userFromArray = users.value.find((u: User) => u.id === userId);
      if (userFromArray) {
        console.log('Usuario encontrado en caché local:', userFromArray);
        currentProfile.value = userFromArray;
        return currentProfile.value;
      }
      
      // Si no hay usuarios cargados, cargar desde localStorage
      if (users.value.length === 0) {
        loadUsersFromLocalStorage();
        
        // Intentar buscar de nuevo
        const userFromStorage = users.value.find((u: User) => u.id === userId);
        if (userFromStorage) {
          console.log('Usuario encontrado en localStorage:', userFromStorage);
          currentProfile.value = userFromStorage;
          return currentProfile.value;
        }
      }
      
      console.log(`Usuario con ID ${userId} no encontrado localmente`);
      error.value = 'Usuario no encontrado';
      return null;
    } catch (err: unknown) {
      error.value = 'Error al cargar perfil de usuario';
      console.error('Error al cargar perfil de usuario:', err);
      return null;
    } finally {
      loading.value = false;
    }
  };

  // Para desarrollo rápido - inicializar con usuarios de ejemplo solo si es necesario
  const initMockUsers = () => {
    // Solo usar en modo desarrollo
    if (!import.meta.env.DEV) {
      console.log('❌ No se inicializan usuarios mock en producción');
      return;
    }
    
    console.log('⚠️ Inicializando usuarios mock (solo para desarrollo)');
    
    // Asignar datos mock al store
      users.value = [...mockUsers];
    
      // Guardar en localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users.value));
    console.log('📦 Usuarios mock guardados en localStorage:', users.value.length);
  };

  // Obtener perfil del usuario actual (desde auth)
  const fetchCurrentUserProfile = async () => {
    if (loading.value) return null;
    
    loading.value = true;
    error.value = null;
    
    try {
      console.log('Obteniendo perfil del usuario actual');
      
      // Intentar obtener userId del localStorage
      const userId = localStorage.getItem('userId');
      
      if (userId) {
        console.log('ID de usuario actual encontrado en localStorage:', userId);
        
        // Buscar en el array de usuarios
        if (users.value.length > 0) {
          const userFromArray = users.value.find((u: User) => u.id === userId);
          if (userFromArray) {
            console.log('Usuario actual encontrado en caché:', userFromArray);
            currentProfile.value = userFromArray;
            return currentProfile.value;
          }
        }
        
        // Si no hay usuarios cargados, cargar desde localStorage
        if (users.value.length === 0) {
          loadUsersFromLocalStorage();
          
          // Intentar buscar de nuevo
          const userFromStorage = users.value.find((u: User) => u.id === userId);
          if (userFromStorage) {
            console.log('Usuario actual encontrado en localStorage:', userFromStorage);
            currentProfile.value = userFromStorage;
            return currentProfile.value;
          }
        }
        
        // Si no se encuentra, pero tenemos el ID, verificar si es uno de los usuarios del sistema
        console.log('Verificando si es un usuario del sistema conocido');
        
        // Usuarios del sistema conocidos (deben coincidir con schema.sql)
        const systemUsers = {
          'admin-123': {
            id: 'admin-123',
            firstName: 'Admin',
            lastName: 'System',
            email: 'admin@growdesk.com',
            role: 'admin' as const,
            department: 'IT',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          'agente-growdesk': {
            id: 'agente-growdesk',
            firstName: 'Agente',
            lastName: 'GrowDesk',
            email: 'agente@growdesk.com',
            role: 'admin' as const,
            department: 'Soporte',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          'widget-system': {
            id: 'widget-system',
            firstName: 'Widget',
            lastName: 'System',
            email: 'widget@system.com',
            role: 'admin' as const,
            department: 'Sistema',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };
        
        if (systemUsers[userId as keyof typeof systemUsers]) {
          console.log('Creando perfil para usuario del sistema:', userId);
          const systemUser = systemUsers[userId as keyof typeof systemUsers];
          
          // Guardar en memoria y localStorage
          users.value.push(systemUser);
          saveUsersToLocalStorage();
          
          currentProfile.value = systemUser;
          return currentProfile.value;
        }
        
        // Solo como último recurso, crear un usuario genérico
        console.log('Creando perfil genérico para usuario desconocido');
        const mockUser: User = {
          id: userId,
          firstName: 'Usuario',
          lastName: 'Desconocido',
          email: `${userId}@growdesk.com`,
          role: 'employee',
          department: 'General',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Guardar en memoria y localStorage
        users.value.push(mockUser);
        saveUsersToLocalStorage();
        
        currentProfile.value = mockUser;
        return currentProfile.value;
      }
      
      // Si no hay userId en localStorage pero tenemos usuarios
      if (users.value.length === 0) {
        loadUsersFromLocalStorage();
      }
      
      // Si hay usuarios, usar el primero como perfil actual
      if (users.value.length > 0) {
        console.log('Usando el primer usuario como perfil actual');
        currentProfile.value = users.value[0];
        
        // Guardar en localStorage para referencia futura
        localStorage.setItem('userId', currentProfile.value.id);
        
        return currentProfile.value;
      }
      
      // Si aún no hay usuarios, inicializar con mock
      console.log('No hay usuarios, inicializando con datos mock');
      initMockUsers();
      
      if (users.value.length > 0) {
        currentProfile.value = users.value[0];
        localStorage.setItem('userId', currentProfile.value.id);
        return currentProfile.value;
      }
      
      console.error('No se pudo obtener o crear un perfil de usuario');
      error.value = 'No se pudo obtener el perfil de usuario';
      return null;
    } catch (err: unknown) {
      error.value = 'Error al cargar perfil del usuario actual';
      console.error('Error al cargar perfil del usuario actual:', err);
      return null;
    } finally {
      loading.value = false;
    }
  };
  
  // Alias para hacer más consistente la API con el auth store
  const getCurrentUser = async (): Promise<User | null> => {
    if (currentProfile.value) {
      return currentProfile.value;
    }
    return fetchCurrentUserProfile();
  };

  // Obtener un usuario por su ID
  const fetchUser = async (userId: string): Promise<User | null> => {
    if (loading.value) return null;
    
    loading.value = true;
    error.value = null;
    
    try {
      console.log(`Obteniendo usuario con ID: ${userId}`);
      
      // Si hay usuarios cargados, intentar encontrarlo en la caché primero
      if (users.value.length > 0) {
        const cachedUser = users.value.find((u: User) => u.id === userId);
        if (cachedUser) {
          console.log('Usuario encontrado en caché:', cachedUser);
          return cachedUser;
        }
      }
      
      // Si no hay usuarios cargados, intentar cargar desde localStorage
      if (users.value.length === 0) {
        loadUsersFromLocalStorage();
        
        // Buscar nuevamente después de cargar
        const userFromStorage = users.value.find((u: User) => u.id === userId);
        if (userFromStorage) {
          console.log('Usuario encontrado en localStorage:', userFromStorage);
          return userFromStorage;
        }
      }
      
      console.log(`Usuario con ID ${userId} no encontrado localmente`);
      
      // Si se trata del usuario actual según localStorage
      if (userId === localStorage.getItem('userId')) {
        console.log('Verificando si es un usuario del sistema conocido');
        
        // Usuarios del sistema conocidos (deben coincidir con schema.sql)
        const systemUsers = {
          'admin-123': {
            id: 'admin-123',
            firstName: 'Admin',
            lastName: 'System',
            email: 'admin@growdesk.com',
            role: 'admin' as const,
            department: 'IT',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          'agente-growdesk': {
            id: 'agente-growdesk',
            firstName: 'Agente',
            lastName: 'GrowDesk',
            email: 'agente@growdesk.com',
            role: 'admin' as const,
            department: 'Soporte',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          'widget-system': {
            id: 'widget-system',
            firstName: 'Widget',
            lastName: 'System',
            email: 'widget@system.com',
            role: 'admin' as const,
            department: 'Sistema',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };
        
        if (systemUsers[userId as keyof typeof systemUsers]) {
          console.log('Creando usuario del sistema:', userId);
          const systemUser = systemUsers[userId as keyof typeof systemUsers];
          
          // Guardar en memoria para futuras consultas
          users.value.push(systemUser);
          saveUsersToLocalStorage();
          
          return systemUser;
        }
        
        console.log('Creando usuario genérico');
        const mockCurrentUser: User = {
          id: userId,
          firstName: 'Usuario',
          lastName: 'Desconocido',
          email: `${userId}@growdesk.com`,
          role: 'employee',
          department: 'General',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Guardar en memoria para futuras consultas
        users.value.push(mockCurrentUser);
        saveUsersToLocalStorage();
        
        return mockCurrentUser;
      }
      
      error.value = 'Usuario no encontrado';
      return null;
    } catch (err) {
      console.error(`Error al obtener usuario con ID ${userId}:`, err);
      error.value = 'Error al obtener usuario';
      return null;
    } finally {
      loading.value = false;
    }
  };

  // Crea un nuevo usuario
  async function createUser(userData: Partial<User>) {
    if (!userData.firstName || !userData.lastName || !userData.email) {
      console.error('❌ Datos incompletos para crear usuario');
      error.value = 'Datos incompletos para crear usuario';
      return null;
    }

    loading.value = true;
    error.value = null;
    
    try {
      console.log('🔄 Creando nuevo usuario:', userData);
      
      // Intentar crear el usuario en la API primero
      try {
        const response = await apiClient.post('/users', userData);
        console.log('✅ Usuario creado en la API:', response.data);
        
        // Agregar el nuevo usuario al array local
        if (response.data && response.data.id) {
          // Agregar el usuario devuelto por la API
          users.value.push(response.data);
          // Actualizar localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(users.value));
          return response.data;
        }
      } catch (apiError) {
        console.error('❌ Error al crear usuario en la API:', apiError);
        
        // Si falla la API, crear localmente como fallback
        if (import.meta.env.DEV) {
          console.log('⚠️ Creando usuario localmente como fallback');
          
          const newUser: User = {
            id: 'user_' + Date.now().toString(),
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            role: userData.role || 'employee',
            active: userData.active !== undefined ? userData.active : true,
            department: userData.department || null,
            position: userData.position || null,
            phone: userData.phone || null,
            language: userData.language || 'es',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          // Guardar en memoria y localStorage
          users.value.push(newUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(users.value));
          return newUser;
        } else {
          // En producción, propagar el error
          throw apiError;
        }
      }
    } catch (err: unknown) {
      console.error('❌ Error general al crear usuario:', err);
      error.value = 'Error al crear el usuario';
      return null;
    } finally {
      loading.value = false;
    }
  }

  const updateUser = async (userId: string, userData: Partial<User>) => {
    loading.value = true;
    error.value = null;

    try {
      console.log('🔄 Actualizando usuario:', userId);
      console.log('📦 Datos a actualizar:', userData);
      
      // Intentar actualizar el usuario en la API primero
      try {
        const response = await apiClient.put(`/users/${userId}`, userData);
        console.log('✅ Usuario actualizado en la API:', response.data);
        
        // Actualizar el usuario en el array local
        if (response.data && response.data.id) {
          const index = users.value.findIndex(u => u.id === userId);
          if (index !== -1) {
            users.value[index] = response.data;
          } else {
            // Si no existe, agregarlo
            users.value.push(response.data);
          }
          
          // Actualizar currentProfile si es el mismo usuario
          if (currentProfile.value?.id === userId) {
            currentProfile.value = response.data;
          }
          
          // Actualizar localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(users.value));
          return response.data;
        }
      } catch (apiError) {
        console.error('❌ Error al actualizar usuario en la API:', apiError);
        
        // Si falla la API, actualizar localmente como fallback
        if (import.meta.env.DEV) {
          console.log('⚠️ Actualizando usuario localmente como fallback');
          
          const index = users.value.findIndex(u => u.id === userId);
          if (index === -1) {
            throw new Error(`Usuario con ID ${userId} no encontrado localmente`);
          }
          
          // Actualizar localmente
          users.value[index] = {
            ...users.value[index],
            ...userData,
            updatedAt: new Date().toISOString()
          };
          
          // Si es el perfil actual, actualizar también
          if (currentProfile.value?.id === userId) {
            currentProfile.value = {
              ...currentProfile.value,
              ...userData,
              updatedAt: new Date().toISOString()
            };
          }
          
          // Actualizar localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(users.value));
          return users.value[index];
        } else {
          // En producción, propagar el error
          throw apiError;
        }
      }
    } catch (err) {
      console.error('❌ Error general al actualizar usuario:', err);
      error.value = 'Error al actualizar el usuario';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const changeUserRole = async (userId: string, newRole: 'admin' | 'assistant' | 'employee') => {
    return updateUser(userId, { role: newRole });
  };
  
  const toggleUserActive = async (userId: string) => {
    const userToToggle = users.value.find((u: User) => u.id === userId);
    if (userToToggle) {
      return updateUser(userId, { active: !userToToggle.active });
    }
    return null;
  };

  const deleteUser = async (userId: string) => {
    loading.value = true;
    error.value = null;

    try {
      console.log('🔄 Eliminando usuario:', userId);
      
      // Intentar eliminar el usuario en la API primero
      try {
        await apiClient.delete(`/users/${userId}`);
        console.log('✅ Usuario eliminado en la API');
        
        // Eliminar del array local
        users.value = users.value.filter(u => u.id !== userId);
        
        // Si es el perfil actual, limpiar
        if (currentProfile.value?.id === userId) {
          currentProfile.value = null;
        }
        
        // Actualizar localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users.value));
        return true;
      } catch (apiError) {
        console.error('❌ Error al eliminar usuario en la API:', apiError);
        
        // Si falla la API, eliminar localmente como fallback
        if (import.meta.env.DEV) {
          console.log('⚠️ Eliminando usuario localmente como fallback');
          
          // Verificar que el usuario existe
          if (!users.value.some(u => u.id === userId)) {
            throw new Error(`Usuario con ID ${userId} no encontrado localmente`);
          }
          
          // Eliminar del array local
          users.value = users.value.filter(u => u.id !== userId);
          
          // Si es el perfil actual, limpiar
          if (currentProfile.value?.id === userId) {
            currentProfile.value = null;
          }
          
          // Actualizar localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(users.value));
          return true;
        } else {
          // En producción, propagar el error
          throw apiError;
        }
      }
    } catch (err) {
      console.error('❌ Error general al eliminar usuario:', err);
      error.value = 'Error al eliminar el usuario';
      return false;
    } finally {
      loading.value = false;
    }
  };

  return {
    // Estado
    users,
    currentProfile,
    loading,
    error,

    // Getters
    getUsersByRole,
    getActiveUsers,
    getInactiveUsers,

    // Acciones
    fetchUsers,
    fetchUser,
    fetchUserProfile,
    fetchCurrentUserProfile,
    getCurrentUser,
    createUser,
    updateUser,
    changeUserRole,
    toggleUserActive,
    deleteUser,
    initMockUsers,
    saveUsersToLocalStorage,
    loadUsersFromLocalStorage
  };
});

// Alias para mantener compatibilidad con código existente
export const useUserStore = useUsersStore; 