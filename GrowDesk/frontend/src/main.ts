import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Importar PrimeVue directamente
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { setupPrimeVue } from './plugins/primevue'

// Importar Bootstrap CSS y JS
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Importar SOLO nuestro tema personalizado - NO importar archivos de PrimeVue
import './styles/theme.css'

// Importar estilos básicos
import './assets/main.css'

import { useUsersStore } from './stores/users'
import { useAuthStore } from './stores/auth'

console.log('🚀 Iniciando aplicación GrowDesk...')
console.log('📊 Entorno:', import.meta.env.MODE)
console.log('🔌 API URL:', import.meta.env.VITE_API_URL || 'no configurada')
console.log('🔄 SYNC API URL:', import.meta.env.VITE_SYNC_API_URL || 'no configurada')

// Verificar estado de localStorage
console.log('🔍 Verificando localStorage...')
console.log('   - token:', localStorage.getItem('token') ? 'presente' : 'ausente')
console.log('   - userId:', localStorage.getItem('userId') ? 'presente' : 'ausente')
console.log('   - user:', localStorage.getItem('user') ? 'presente' : 'ausente')

// Función para limpiar localStorage de datos corruptos
const cleanLocalStorage = async () => {
  try {
    // Comprobar si es necesario limpiar basado en versión en archivo JSON
    console.log('🧹 Intentando cargar localStorage-fix.json...')
    const response = await fetch('/localStorage-fix.json');
    if (response.ok) {
      const { id, version } = await response.json();
      console.log(`✅ localStorage-fix.json cargado: id=${id}, version=${version}`)
      const lastCleanVersion = localStorage.getItem('localStorage-clean-version');
      console.log(`   - Última versión de limpieza: ${lastCleanVersion || 'ninguna'}`)
      
      // Si la versión es nueva o no existe, limpiar y actualizar versión
      if (!lastCleanVersion || parseInt(lastCleanVersion) < version) {
        console.log('Iniciando limpieza de localStorage...');
        
        // Importar utilitarios de validación
        const { 
          cleanLocalStorageData, 
          isValidUser, 
          isValidTicket, 
          isValidCategory 
        } = await import('./utils/validators');
        
        // Limpiar cada tipo de datos con su validador adecuado
        cleanLocalStorageData<any>('growdesk-users', isValidUser);
        cleanLocalStorageData<any>('growdesk_tickets', isValidTicket);
        cleanLocalStorageData<any>('growdesk-categories', isValidCategory);
        
        // Marcar que se completó la limpieza con esta versión
        localStorage.setItem('localStorage-clean-version', version.toString());
        console.log('Limpieza de localStorage completada');
      } else {
        console.log('   - No es necesario limpiar localStorage')
      }
    } else {
      console.warn('⚠️ No se pudo cargar localStorage-fix.json:', response.status)
    }
  } catch (err) {
    console.error('❌ Error al limpiar localStorage:', err);
  }
};

// Llamar a la función de limpieza antes de iniciar la app
cleanLocalStorage().catch(err => console.error('Error en proceso de limpieza:', err));

// Crear app
const app = createApp(App)
console.log('📱 App Vue creada')

// Configurar pinia
const pinia = createPinia()
app.use(pinia)
console.log('📦 Pinia configurada')

// Configurar router
app.use(router)
console.log('🧭 Router configurado')

// Configurar PrimeVue
app.use(PrimeVue, { 
  ripple: true,
  inputStyle: "filled"
})
app.use(ToastService)
setupPrimeVue(app)
console.log('🎨 PrimeVue configurado')

// Inicializar stores - tanto en desarrollo como en producción
setTimeout(async () => {
  try {
    console.log('⏱️ Iniciando configuración de stores...')
    
    // Inicializar usuarios mock solo en modo desarrollo
    if (import.meta.env.DEV) {
      const userStore = useUsersStore()
      userStore.initMockUsers()
      console.log('👤 Usuarios mock inicializados desde main.ts (solo para login)')
    }
    
    // Proporcionar el router al auth store
    const authStore = useAuthStore()
    authStore.setRouter(router)
    console.log('🔗 Router proporcionado al auth store')
    
    // Comprobar si hay una sesión activa (token válido existente)
    console.log('🔐 Verificando estado de autenticación...')
    const isAuthenticated = await authStore.checkAuth()
    console.log('🔓 App inicializada, estado de autenticación:', isAuthenticated ? 'autenticado' : 'no autenticado')
    
    // Si está autenticado, asegurarse de que el usuario tenga datos
    if (isAuthenticated && !authStore.user) {
      console.warn('⚠️ Usuario autenticado pero sin datos de usuario, intentando recuperar perfil...')
      await authStore.fetchCurrentUserProfile()
    }
    
    // Verificar estado final de autenticación
    console.log('🔒 Estado final de autenticación:', {
      isAuthenticated: authStore.isAuthenticated,
      token: authStore.token ? 'presente' : 'ausente',
      user: authStore.user ? `${authStore.user.firstName} ${authStore.user.lastName}` : 'ausente'
    })
  } catch (error) {
    console.error('❌ Error durante la inicialización de la app:', error)
  }
}, 100)

// Montar app
app.mount('#app')
console.log('🏁 App montada, estado autenticación pendiente de verificación')