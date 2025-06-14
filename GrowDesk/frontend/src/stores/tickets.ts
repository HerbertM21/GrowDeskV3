import { defineStore } from 'pinia'
import apiClient from '@/api/client'
import { useActivityStore } from './activity'
import { useAuthStore } from './auth'
import ticketService from '@/services/ticketService'

// Constante para almacenar las etiquetas en el localStorage
const TAGS_STORAGE_KEY = 'growdesk_tags'

// añade el key para los tickets
const TICKETS_STORAGE_KEY = 'growdesk_tickets'

export interface Ticket {
  id: string
  title: string
  description: string
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  category: string
  createdBy: string
  assignedTo: string | null
  createdAt: string
  updatedAt: string
  tags?: Tag[] | string[]
}

export interface Tag {
  id: string
  name: string
  color: string
  category?: string
}

interface TicketState {
  tickets: Ticket[]
  currentTicket: Ticket | null
  loading: boolean
  error: string | null
  tags: Tag[]
}

// Helper function to save tags to localStorage
const saveTagsToStorage = (tags: Tag[]) => {
  try {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags))
    console.log('Tags saved to localStorage:', tags.length)
  } catch (error) {
    console.error('Error saving tags to localStorage:', error)
  }
}

// Helper function to load tags from localStorage
const loadTagsFromStorage = (): Tag[] => {
  try {
    const tagsJson = localStorage.getItem(TAGS_STORAGE_KEY)
    if (tagsJson) {
      const tags = JSON.parse(tagsJson)
      console.log('Tags loaded from localStorage:', tags.length)
      return tags
    }
  } catch (error) {
    console.error('Error loading tags from localStorage:', error)
  }
  return []
}

// Helper function to save tickets to localStorage
const saveTicketsToStorage = (tickets: Ticket[]) => {
  try {
    localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets))
    console.log('Tickets saved to localStorage:', tickets.length)
  } catch (error) {
    console.error('Error saving tickets to localStorage:', error)
  }
}

// Helper function to load tickets from localStorage
const loadTicketsFromStorage = (): Ticket[] => {
  try {
    // Importar la función de validación para limpiar los datos
    import('@/utils/validators').then(({ filterValidTickets }) => {
      try {
        const data = localStorage.getItem(TICKETS_STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            const valid = filterValidTickets(parsed);
            if (valid.length !== parsed.length) {
              localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(valid));
              console.warn(`Se limpiaron ${parsed.length - valid.length} tickets inválidos`);
            }
          }
        }
      } catch (e) {
        console.error('Error al limpiar tickets del localStorage:', e);
      }
    }).catch(e => console.error('Error al importar utilidades de validación:', e));
    
    const ticketsJson = localStorage.getItem(TICKETS_STORAGE_KEY)
    if (ticketsJson) {
      const parsed = JSON.parse(ticketsJson)
      
      // Verificar que es un array válido
      if (!Array.isArray(parsed)) {
        console.error('Datos de tickets no son un array válido');
        return [];
      }
      
      // Filtrar para asegurar que solo tenemos objetos válidos
      const validTickets = parsed.filter(item => 
        typeof item === 'object' && 
        item !== null && 
        'id' in item && 
        'title' in item &&
        'status' in item
      );
      
      if (validTickets.length !== parsed.length) {
        console.warn(`Se filtraron ${parsed.length - validTickets.length} tickets inválidos`);
        localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(validTickets));
      }
      
      console.log('Tickets loaded from localStorage:', validTickets.length)
      return validTickets
    }
  } catch (error) {
    console.error('Error loading tickets from localStorage:', error)
  }
  return []
}

export const useTicketStore = defineStore('tickets', {
  state: (): TicketState => ({
    tickets: [],
    currentTicket: null,
    loading: false,
    error: null,
    tags: []
  }),

  getters: {
    openTickets: (state: TicketState) => state.tickets.filter((ticket: Ticket) => ticket.status === 'open'),
    inProgressTickets: (state: TicketState) => state.tickets.filter((ticket: Ticket) => ticket.status === 'in_progress'),
    urgentTickets: (state: TicketState) => state.tickets.filter((ticket: Ticket) => ticket.priority === 'URGENT'),
    assignedTickets: (state: TicketState) => state.tickets.filter((ticket: Ticket) => ticket.assignedTo),
    resolvedTickets: (state: TicketState) => state.tickets.filter((ticket: Ticket) => ticket.status === 'resolved'),
    closedTickets: (state: TicketState) => state.tickets.filter((ticket: Ticket) => ticket.status === 'closed'),
    ticketsPerDay: (state: TicketState) => {
      const ticketsByDay = new Map<string, number>()
      
      state.tickets.forEach((ticket: Ticket) => {
        const date = new Date(ticket.createdAt).toISOString().split('T')[0]
        ticketsByDay.set(date, (ticketsByDay.get(date) || 0) + 1)
      })
      
      // Convertir a array y ordenar por fecha
      return Array.from(ticketsByDay.entries())
        .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
    }
  },

  actions: {
    async fetchTickets() {
      this.loading = true
      this.error = null
      
      try {
        console.log('🔄 Comenzando fetchTickets - Llamando API...')
        
        // Intentar primero obtener tickets del servicio
        let apiTickets: Ticket[] = [];
        try {
          const response = await ticketService.getAllTickets();
          console.log('✅ Respuesta API fetchTickets:', response);
          apiTickets = response;
        } catch (apiError) {
          console.error('❌ Error al obtener tickets desde API:', apiError);
          apiTickets = [];
        }
        
        // Cargar tickets guardados en localStorage
        const savedTickets = loadTicketsFromStorage();
        console.log(`📦 Tickets en localStorage: ${savedTickets.length}`);
        
        // Combinar tickets: priorizar datos del API pero mantener tickets locales que no existan en API
        if (Array.isArray(apiTickets) && apiTickets.length > 0) {
          console.log(`🔄 Combinando ${apiTickets.length} tickets de API con ${savedTickets.length} tickets locales`);
          
          // Crear un mapa de tickets del API por ID para búsqueda rápida
          const apiTicketsMap = new Map();
          apiTickets.forEach(ticket => {
            apiTicketsMap.set(ticket.id, ticket);
          });
          
          // Encontrar tickets locales que no existen en la respuesta de la API
          const localOnlyTickets = savedTickets.filter(localTicket => 
            !apiTicketsMap.has(localTicket.id)
          );
          
          if (localOnlyTickets.length > 0) {
            console.log(`⚠️ Encontrados ${localOnlyTickets.length} tickets solo en localStorage`);
            
            // Añadir tickets locales a la lista de la API
            this.tickets = [...apiTickets, ...localOnlyTickets];
          } else {
            this.tickets = apiTickets;
          }
          
          console.log(`📊 Total tickets después de combinar: ${this.tickets.length}`);
        } else {
          // Si no hay tickets de la API, usar los guardados localmente
          console.log('⚠️ No hay tickets de API, usando tickets de localStorage');
          this.tickets = savedTickets;
        }
        
        // Guardar la lista combinada en localStorage
        saveTicketsToStorage(this.tickets);
        console.log('💾 Lista de tickets actualizada guardada en localStorage');
        
        // Forzar una segunda llamada al API para asegurar sincronización completa
        setTimeout(async () => {
          try {
            console.log('🔄 Realizando segunda sincronización de tickets...');
            const refreshResponse = await apiClient.get('/tickets');
            
            if (Array.isArray(refreshResponse.data) && refreshResponse.data.length > 0) {
              // Actualizar solo si hay datos válidos
              this.tickets = refreshResponse.data;
              saveTicketsToStorage(this.tickets);
              console.log('✅ Segunda sincronización completada, tickets actualizados');
            }
          } catch (refreshError) {
            console.warn('⚠️ Error en segunda sincronización:', refreshError);
          }
        }, 2000);
        
      } catch (error) {
        console.error('❌ Error general en fetchTickets:', error);
        this.error = 'Error al cargar los tickets';
        
        // Si hay un error, intentar recuperar tickets almacenados localmente
        const savedTickets = loadTicketsFromStorage();
        if (savedTickets && savedTickets.length > 0) {
          console.log('🔄 Recuperando tickets de localStorage después de error de API');
          this.tickets = savedTickets;
        } else {
          // Si no hay tickets guardados, inicializar como array vacío
          this.tickets = [];
        }
      } finally {
        this.loading = false;
      }
    },

    async fetchUserTickets(userId: string) {
      this.loading = true
      this.error = null
      
      try {
        console.log(`Buscando tickets asignados al usuario ${userId}`);
        
        // Primero cargar todos los tickets si aún no están cargados
        if (this.tickets.length === 0) {
          console.log('La lista de tickets está vacía, cargando todos los tickets primero');
          await this.fetchTickets();
        }
        
        // Intentar encontrar el ticket específico que mencionó el usuario
        const specificTicket = this.tickets.find((ticket: Ticket) => ticket.id === 'TICKET-20250327041753');
        if (specificTicket) {
          console.log('Ticket específico mencionado encontrado:', specificTicket);
          console.log('Estado de asignación:', specificTicket.assignedTo === userId ? 'Asignado al usuario actual' : 'No asignado al usuario actual');
        } else {
          console.log('Ticket específico mencionado no encontrado en el sistema');
        }
        
        // Filtrar los tickets donde el usuario es asignado con log detallado
        console.log(`Total de tickets en el sistema: ${this.tickets.length}`);
        console.log('IDs de todos los tickets:', this.tickets.map((t: Ticket) => t.id).join(', '));
        console.log('Detalles de asignación de todos los tickets:');
        this.tickets.forEach((ticket: Ticket) => {
          console.log(`Ticket ${ticket.id}: assignedTo=${ticket.assignedTo}, userId=${userId}, match=${ticket.assignedTo === userId}`);
        });
        
        const assignedTickets = this.tickets.filter((ticket: Ticket) => {
          // Comparación insensible a mayúsculas/minúsculas y trim para mayor flexibilidad
          const ticketAssignedTo = String(ticket.assignedTo || '').trim();
          const currentUserId = String(userId || '').trim();
          const isMatch = ticketAssignedTo.toLowerCase() === currentUserId.toLowerCase();
          
          console.log(`Comparación ticket ${ticket.id}: "${ticketAssignedTo}" vs "${currentUserId}" = ${isMatch}`);
          return isMatch;
        });
        
        console.log(`Encontrados ${assignedTickets.length} tickets asignados al usuario ${userId}:`, assignedTickets);
        
        if (assignedTickets.length > 0) {
          return assignedTickets;
        }
        
        // Si no hay tickets asignados, mostrar mensaje claro
        console.warn('No se encontraron tickets asignados para el usuario:', userId);
        return [];
      } catch (error) {
        this.error = 'Error al cargar los tickets del usuario';
        console.error('Error fetching user tickets:', error);
        return [];
      } finally {
        this.loading = false;
      }
    },

    async fetchTicket(id: string) {
      this.loading = true
      this.error = null
      
      console.log('Intentando cargar ticket:', id)
      
      try {
        const response = await apiClient.get(`/tickets/${id}`)
        console.log('Respuesta al cargar ticket:', response.data)
        this.currentTicket = response.data
      } catch (error) {
        console.error('Error al cargar ticket:', error)
        this.error = 'Failed to fetch ticket'
        
        // Para depuración, crear un ticket ficticio
        if (import.meta.env.DEV) {
          console.warn('Usando ticket de prueba en modo desarrollo')
          this.currentTicket = {
            id: id,
            title: 'Ticket de prueba',
            description: 'Este es un ticket de prueba generado automáticamente.',
            status: 'open',
            priority: 'medium',
            category: 'technical',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system',
            assignedTo: null,
            customer: {
              name: 'Cliente de prueba',
              email: 'cliente@example.com'
            }
          }
        } else {
          throw error
        }
      } finally {
        this.loading = false
      }
    },

    async createTicket(ticketData: {
      title: string
      description: string
      priority: Ticket['priority']
      category: string
    }) {
      // Esta función ha sido deshabilitada porque conceptualmente
      // los tickets solo deben ser creados por los clientes a través del widget.
      console.warn('La creación de tickets desde el panel de soporte está deshabilitada. Los tickets deben ser creados por los clientes a través del widget.');
      this.error = 'La creación de tickets desde el panel de soporte no está permitida';
      return null;
    },

    async updateTicket(ticketOrId: string | Ticket, ticketData?: Partial<Ticket>) {
      this.loading = true
      this.error = null
      
      let ticketId: string
      let dataToSend: Partial<Ticket>
      
      if (typeof ticketOrId === 'string') {
        ticketId = ticketOrId
        dataToSend = ticketData || {}
      } else {
        ticketId = ticketOrId.id
        dataToSend = { ...ticketOrId }
        delete dataToSend.id // No enviar el ID en el cuerpo
      }
      
      console.log(`🔄 Actualizando ticket ${ticketId} con datos:`, dataToSend)
      
      try {
                 // Llamar al API para actualizar el ticket
         const response = await apiClient.put(`/tickets/${ticketId}`, dataToSend)
         console.log('📡 Respuesta del servidor:', response.data)
        
        if (!response.data) {
           throw new Error('No se recibió respuesta del servidor')
        }
        
         // Encontrar el ticket en la lista local
         const index = this.tickets.findIndex((t: Ticket) => t.id === ticketId)
         
        if (index !== -1) {
           // ⚠️ CRÍTICO: No sobrescribir campos importantes con datos del localStorage
           // Fusionar datos del servidor con datos existentes CONSERVANDO datos importantes del servidor
           const existingTicket = this.tickets[index]
           const serverData = response.data
           
           // Campos que deben venir SIEMPRE del servidor (no del localStorage)
           const serverOnlyFields = {
             assignedTo: serverData.assignedTo,  // ⭐ CRÍTICO para asignaciones
             status: serverData.status,
             updatedAt: serverData.updatedAt,
             // Conservar otros campos importantes del servidor
             id: serverData.id,
             createdAt: serverData.createdAt,
             createdBy: serverData.createdBy
            }
            
           // Campos que podemos conservar del ticket local si el servidor no los devuelve
           const fallbackFields = {
             title: serverData.title ?? existingTicket.title,
             description: serverData.description ?? existingTicket.description,
             priority: serverData.priority ?? existingTicket.priority,
             category: serverData.category ?? existingTicket.category,
             tags: serverData.tags ?? existingTicket.tags,
             // Usar datos del servidor para metadatos, o conservar locales
             userID: serverData.userID ?? existingTicket.userID,
             department: serverData.department ?? existingTicket.department
           }
           
           // Combinar: campos del servidor + fallbacks
           const updatedTicket = {
             ...fallbackFields,
             ...serverOnlyFields  // Los campos del servidor SIEMPRE ganan
           }
           
           console.log('🔄 Ticket actualizado localmente:', {
             before: existingTicket,
             after: updatedTicket,
             serverResponse: serverData
           })
            
           // Actualizar en el array local
            this.tickets[index] = updatedTicket
            
           // Si es el ticket actual, actualizarlo también
           if (this.currentTicket?.id === ticketId) {
             this.currentTicket = { ...updatedTicket }
             console.log('🎯 currentTicket actualizado también')
           }
           
           // Guardar en localStorage DESPUÉS de sincronizar con el servidor
           console.log('💾 Guardando en localStorage después de sincronización')
           saveTicketsToStorage(this.tickets)
         } else {
           console.warn(`⚠️ Ticket ${ticketId} no encontrado en la lista local, añadiendo...`)
           this.tickets.push(response.data)
           saveTicketsToStorage(this.tickets)
         }
         
         console.log('✅ updateTicket completado exitosamente')
         return response.data
      } catch (error: any) {
        console.error('❌ Error al actualizar ticket:', error)
        this.error = `Error al actualizar ticket: ${error.message}`
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteTicket(id: string) {
      this.loading = true
      this.error = null
      try {
        await apiClient.delete(`/tickets/${id}`)
        this.tickets = this.tickets.filter((t: Ticket) => t.id !== id)
        if (this.currentTicket?.id === id) {
          this.currentTicket = null
        }
        
        // Registrar actividad de eliminación de ticket
        const activityStore = useActivityStore()
        const authStore = useAuthStore()
        const currentUserId = authStore.user?.id
        
        if (currentUserId) {
          await activityStore.logActivity({
            userId: currentUserId,
            type: 'ticket_closed',
            targetId: id,
            description: `Eliminó el ticket #${id}`
          })
        }
        
        return true
      } catch (error) {
        this.error = 'Failed to delete ticket'
        console.error('Error deleting ticket:', error)
        return false
      } finally {
        this.loading = false
      }
    },

    // Función de depuración para asignación de tickets
    debugAssignment(ticketId: string) {
      const ticket = this.tickets.find((t: Ticket) => t.id === ticketId);
      console.group('🔍 Debug estado de asignación de ticket');
      console.log('Ticket ID:', ticketId);
      console.log('Ticket encontrado:', ticket ? 'Sí' : 'No');
      if (ticket) {
        console.log('Estado:', ticket.status);
        console.log('Asignado a:', ticket.assignedTo || 'No asignado');
        console.log('Actualizado:', ticket.updatedAt);
        console.log('Datos completos:', ticket);
      } else {
        console.log('Tickets disponibles:', this.tickets.map((t: Ticket) => t.id));
      }
      console.groupEnd();
    },

    async assignTicket(id: string, agentId: string) {
      this.loading = true
      this.error = null
      console.log(`🚀 Iniciando asignación de ticket: ${id} a usuario: ${agentId}`);
      
      // Debug estado inicial
      this.debugAssignment(id);
      
      try {
        if (!id) {
          throw new Error('ID de ticket requerido para asignar');
        }
        
        if (!agentId) {
          throw new Error('ID de agente requerido para asignar');
        }
        
        console.log(`📡 Llamando a API para asignar ticket ${id} a ${agentId}`);
        
        // Preparar datos de asignación
        const assignData = {
          assignedTo: agentId,
          status: 'assigned'
        };
        
        console.log('📋 Datos de asignación:', assignData);
        
        // Usar el servicio de tickets para asignación
        try {
          const response = await ticketService.assignTicket(id, agentId);
          console.log(`🎯 Asignación exitosa via ticketService:`, response);
          
          // Actualizar el ticket en el store local usando los datos del servidor
          const index = this.tickets.findIndex((t: Ticket) => t.id === id);
          if (index !== -1) {
            // Usar SIEMPRE los datos del servidor para campos críticos
            this.tickets[index] = {
              ...this.tickets[index],  // Conservar datos locales
              ...response,             // Sobrescribir con datos del servidor
              // Campos críticos que deben venir del servidor
              assignedTo: response.assignedTo || agentId,
              status: response.status || 'assigned',
              updatedAt: response.updatedAt || new Date().toISOString()
            };
            
            // Si es el ticket actual, actualizar también
            if (this.currentTicket?.id === id) {
              this.currentTicket = { ...this.tickets[index] };
            }
            
            // Guardar en localStorage DESPUÉS de sincronizar con servidor
            saveTicketsToStorage(this.tickets);
          }
          
          // Registrar actividad de asignación
          const activityStore = useActivityStore()
          const authStore = useAuthStore()
          const currentUserId = authStore.user?.id
          
          if (currentUserId) {
            await activityStore.logActivity({
              userId: currentUserId,
              type: 'ticket_assigned',
              targetId: id,
              description: `Asignó el ticket #${id} al usuario #${agentId}`,
              metadata: {
                assigneeId: agentId
              }
            })
          }
          
          // Debug estado después de asignación exitosa
          console.log('✅ Asignación completada via ticketService');
          this.debugAssignment(id);
          
          return response;
        } catch (assignError: any) {
          console.log('⚠️ Endpoint de asignación falló, usando fallback updateTicket', assignError);
          
          // Fallback a updateTicket si el endpoint de asignación no está disponible
        const updateData = {
          status: 'assigned' as const,
          assignedTo: agentId
        };
        
          const response = await this.updateTicket(id, updateData);
          console.log(`🔄 Asignación exitosa via updateTicket fallback:`, response);
          
          if (!response) {
            throw new Error('No se recibieron datos en la respuesta de asignación');
          }
          
          // Asegurar que currentTicket se actualiza correctamente
          if (this.currentTicket?.id === id) {
            this.currentTicket = { ...response };
          }
          
          // Registrar actividad de asignación
          const activityStore = useActivityStore()
          const authStore = useAuthStore()
          const currentUserId = authStore.user?.id
          
          if (currentUserId) {
            await activityStore.logActivity({
              userId: currentUserId,
              type: 'ticket_assigned',
              targetId: id,
              description: `Asignó el ticket #${id} al usuario #${agentId}`,
              metadata: {
                assigneeId: agentId
              }
            })
          }
          
          // Debug estado después de asignación via fallback
          console.log('✅ Asignación completada via updateTicket fallback');
          this.debugAssignment(id);
          
          return response;
        }
      } catch (error: any) {
        // Crear mensaje de error detallado
        let errorMessage = 'Error al asignar ticket';
        
        if (error.message) {
          errorMessage = `Error al asignar ticket: ${error.message}`;
        }
        
        this.error = errorMessage;
        console.error('Error detallado durante la asignación del ticket:', error);
        
        // Para desarrollo, simular una actualización exitosa
        if (import.meta.env.DEV) {
          console.log('Modo desarrollo: Simulando asignación exitosa');
          const index = this.tickets.findIndex((t: Ticket) => t.id === id)
          if (index !== -1) {
            const updatedTicket = {
              ...this.tickets[index],
              status: 'assigned',
              assignedTo: agentId,
              updatedAt: new Date().toISOString()
            }
            
            // Actualizar en el array
            this.tickets[index] = updatedTicket
            
            // Si es el ticket actual, actualizar también
            if (this.currentTicket?.id === id) {
              this.currentTicket = updatedTicket
            }
            
            console.log('Asignación simulada completada', updatedTicket);
            return updatedTicket;
          }
        }
        
        throw error; // Re-lanzar el error para permitir manejo externo
      } finally {
        this.loading = false
      }
    },

    async updateTicketStatus(id: string, status: Ticket['status']) {
      // Registrar el estado anterior
      const originalTicket = this.tickets.find((t: Ticket) => t.id === id);
      const oldStatus = originalTicket?.status;
      
      try {
        // Añade el index del ticket en el array
        const index = this.tickets.findIndex((t: Ticket) => t.id === id);
        
        if (index === -1) {
          throw new Error('Ticket not found');
        }
        
        // Crea un nuevo objeto de ticket con el estado actualizado mientras se preservan todas las demás propiedades
        const updatedTicket = {
          ...this.tickets[index],
          status,
          updatedAt: new Date().toISOString()
        };
        
        // Actualiza el ticket en el array
        this.tickets[index] = updatedTicket;
        
        // Guarda los tickets en el localStorage para persistir los cambios
        saveTicketsToStorage(this.tickets);
        
        // Intenta actualizar el ticket via API
        try {
          await this.updateTicket(id, { status });
        } catch (apiError) {
          console.error('API update failed, but local changes were preserved:', apiError);
          // Continúa la ejecución incluso si la llamada a la API falla - ya hemos actualizado localmente
        }
        
        // Si la actualización fue exitosa y hubo un cambio de estado, registra la actividad
        if (oldStatus !== status) {
          const activityStore = useActivityStore();
          const authStore = useAuthStore();
          const currentUserId = authStore.user?.id;
          
          if (currentUserId) {
            let activityType: 'ticket_status_changed' | 'ticket_closed' | 'ticket_reopened' = 'ticket_status_changed';
            
            // Determina el tipo de actividad basado en el cambio de estado
            if (status === 'closed') {
              activityType = 'ticket_closed';
            } else if (oldStatus === 'closed') {
              activityType = 'ticket_reopened';
            }
            
            await activityStore.logActivity({
              userId: currentUserId,
              type: activityType,
              targetId: id,
              description: `Cambió el estado del ticket #${id} de ${this.translateStatus(oldStatus || 'desconocido')} a ${this.translateStatus(status)}`,
              metadata: {
                oldStatus,
                newStatus: status
              }
            });
          }
        }
        
        return updatedTicket;
      } catch (error) {
        console.error('Error updating ticket status:', error);
        throw error;
      }
    },

    async updateTicketPriority(id: string, priority: string) {
      this.loading = true;
      this.error = null;
      
      try {
        console.log(`🚀 Iniciando actualización de prioridad: ${id} a ${priority}`);
        
        // Validar ID del ticket
        if (!id) {
          throw new Error('ID de ticket requerido para actualizar prioridad');
        }
        
        // Normalizar prioridad
        const normalizedPriority = this.normalizePriority(priority);
        console.log(`📊 Prioridad normalizada: ${normalizedPriority}`);
        
        // Encontrar el ticket en la lista local
        const index = this.tickets.findIndex((t: Ticket) => t.id === id);
        if (index === -1) {
          throw new Error(`Ticket no encontrado: ${id}`);
        }
        
        // Usar el servicio específico para actualizar prioridad
        try {
          const response = await ticketService.updateTicketPriority(id, normalizedPriority);
          console.log(`✅ Prioridad actualizada exitosamente via API:`, response);
          
          // Actualizar el ticket en el store con los datos del servidor
          if (response) {
            this.tickets[index] = {
              ...this.tickets[index],
              priority: response.priority || normalizedPriority,
              updatedAt: response.updatedAt || new Date().toISOString()
            };
            
            // Si es el ticket actual, actualizar también
            if (this.currentTicket?.id === id) {
              this.currentTicket = { ...this.tickets[index] };
            }
            
            // Guardar en localStorage
            saveTicketsToStorage(this.tickets);
            
            return response;
          }
        } catch (apiError) {
          console.error('❌ Error al actualizar prioridad via API:', apiError);
          
          // Fallback: actualizar localmente si la API falla
          console.log('⚠️ Usando fallback para actualizar prioridad localmente');
          
          // Actualizar localmente
          this.tickets[index] = {
            ...this.tickets[index],
            priority: normalizedPriority,
            updatedAt: new Date().toISOString()
          };
          
          // Si es el ticket actual, actualizar también
          if (this.currentTicket?.id === id) {
            this.currentTicket = { ...this.tickets[index] };
          }
          
          // Guardar en localStorage
          saveTicketsToStorage(this.tickets);
          
          // Devolver el ticket actualizado localmente
          return this.tickets[index];
        }
      } catch (error: any) {
        console.error('❌ Error general al actualizar prioridad:', error);
        this.error = `Error al actualizar prioridad: ${error.message}`;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    normalizePriority(priority: string): string {
      const p = String(priority).toLowerCase()
      if (p === 'high' || p === 'alta') return 'HIGH'
      if (p === 'medium' || p === 'media' || p === 'normal') return 'MEDIUM'
      if (p === 'low' || p === 'baja') return 'LOW'
      if (p === 'urgent' || p === 'urgente' || p === 'crítica' || p === 'critical') return 'URGENT'
      return 'MEDIUM'
    },
    
    // Método de ayuda para traducir estados
    translateStatus(status: string): string {
      const statusMap: Record<string, string> = {
        'open': 'Abierto',
        'assigned': 'Asignado',
        'in_progress': 'En Progreso',
        'resolved': 'Resuelto',
        'closed': 'Cerrado'
      }
      
      return statusMap[status] || status
    },
    
    // Gestión de etiquetas
    async fetchTags() {
      this.loading = true
      
      try {
        // Primero intenta cargar desde localStorage
        const savedTags = loadTagsFromStorage()
        
        if (savedTags && savedTags.length > 0) {
          this.tags = savedTags
          return
        }
        
        // En un entorno real, esto haría una llamada a la API para obtener las etiquetas
        // En este caso, vamos a simular la llamada con datos de ejemplo
        console.log('No tags found in localStorage, loading example tags...')
        
        // En un entorno de desarrollo, podemos crear algunas etiquetas de ejemplo
        if (import.meta.env.DEV && this.tags.length === 0) {
          this.tags = [
            { id: '1', name: 'Bug', color: '#ff0000', category: 'technical' },
            { id: '2', name: 'Mejora', color: '#00ff00', category: 'feature' },
            { id: '3', name: 'Consulta', color: '#0000ff', category: 'general' },
            { id: '4', name: 'Documentación', color: '#ffff00', category: 'documentation' },
            { id: '5', name: 'Crítico', color: '#ff00ff', category: 'technical' }
          ]
          
          // Guarda las etiquetas de ejemplo en localStorage
          saveTagsToStorage(this.tags)
        }
      } catch (error) {
        console.error('Error al obtener etiquetas:', error)
        this.error = 'Error al cargar las etiquetas'
      } finally {
        this.loading = false
      }
    },
    
    async createTag(tagData: Omit<Tag, 'id'>) {
      try {
        // En un entorno real, esto haría una llamada a la API para crear una etiqueta
        console.log('Creando etiqueta:', tagData)
        
        // Generar un ID único para la nueva etiqueta
        const id = Date.now().toString()
        
        // Crear la nueva etiqueta
        const newTag: Tag = {
          id,
          ...tagData
        }
        
        // Añadir la etiqueta a la lista
        this.tags.push(newTag)
        
        // Guarda en localStorage
        saveTagsToStorage(this.tags)
        
        return newTag
      } catch (error) {
        console.error('Error al crear etiqueta:', error)
        this.error = 'Error al crear la etiqueta'
        throw error
      }
    },
    
    async updateTag(id: string, tagData: Partial<Tag>) {
      try {
        // En un entorno real, esto haría una llamada a la API para actualizar una etiqueta
        console.log('Actualizando etiqueta:', id, tagData)
        
        // Buscar la etiqueta a actualizar
        const index = this.tags.findIndex((tag: Tag) => tag.id === id)
        if (index === -1) {
          throw new Error('Etiqueta no encontrada')
        }
        
        // Actualizar la etiqueta
        this.tags[index] = {
          ...this.tags[index],
          ...tagData
        }
        
        // Update tag references in all tickets that use this tag
        this.tickets.forEach((ticket: Ticket) => {
          if (ticket.tags && Array.isArray(ticket.tags)) {
            ticket.tags = ticket.tags.map((tag: Tag | string) => {
              if (typeof tag === 'string') {
                return tag === id ? this.tags[index] : tag
              } else {
                // If it's a tag object, update it if the ID matches
                return tag.id === id ? this.tags[index] : tag
              }
            })
          }
        })
        
        // Guarda las etiquetas en localStorage
        saveTagsToStorage(this.tags)
        
        // Guarda los tickets en localStorage para persistir los cambios
        saveTicketsToStorage(this.tickets)
        
        return this.tags[index]
      } catch (error) {
        console.error('Error al actualizar etiqueta:', error)
        this.error = 'Error al actualizar la etiqueta'
        throw error
      }
    },
    
    async deleteTag(id: string) {
      try {
        // En un entorno real, esto haría una llamada a la API para eliminar una etiqueta
        console.log('Eliminando etiqueta:', id)
        
        // Eliminar la etiqueta de la lista
        this.tags = this.tags.filter((tag: Tag) => tag.id !== id)
        
        // También eliminar la etiqueta de todos los tickets que la tengan
        this.tickets.forEach((ticket: Ticket) => {
          if (ticket.tags) {
            // Crea un array correctamente tipado basado en lo que detectamos
            const newTags = ticket.tags.filter((tagId: Tag | string) => 
              typeof tagId === 'string' ? tagId !== id : tagId.id !== id
            );
            
            // Comprueba si el primer elemento es una cadena o un objeto Tag para determinar el tipo de array
            if (newTags.length > 0 && typeof newTags[0] === 'string') {
              // Es un array de cadenas
              ticket.tags = newTags as string[];
            } else {
              // Es un array de objetos Tag o un array vacío
              ticket.tags = newTags as Tag[];
            }
          }
        })
        
        // Guarda en localStorage
        saveTagsToStorage(this.tags)
        saveTicketsToStorage(this.tickets)
        
        return true
      } catch (error) {
        console.error('Error al eliminar etiqueta:', error)
        this.error = 'Error al eliminar la etiqueta'
        throw error
      }
    },
    
    async addTagToTicket(ticketId: string, tagId: string) {
      try {
        // En un entorno real, esto haría una llamada a la API para añadir una etiqueta a un ticket
        console.log('Añadiendo etiqueta a ticket:', ticketId, tagId)
        
        // Buscar el ticket
        const ticketIndex = this.tickets.findIndex((ticket: Ticket) => ticket.id === ticketId)
        if (ticketIndex === -1) {
          throw new Error('Ticket no encontrado')
        }
        
        // Buscar la etiqueta
        const tag = this.tags.find((tag: Tag) => tag.id === tagId)
        if (!tag) {
          throw new Error('Etiqueta no encontrada')
        }
        
        // Verificar si la etiqueta ya está en el ticket
        const ticket = this.tickets[ticketIndex]
        if (!ticket.tags) {
          ticket.tags = []
        }
        
        // Si la etiqueta ya está en el ticket, no hacer nada
        const hasTag = ticket.tags.some((t: Tag | string) => 
          typeof t === 'string' ? t === tagId : t.id === tagId
        )
        
        if (!hasTag) {
          // Añadir la etiqueta al ticket
          ticket.tags.push(tag)
          
          // Guarda las etiquetas en localStorage
          saveTagsToStorage(this.tags)
          
          // Guarda los tickets en localStorage para persistir la relación
          saveTicketsToStorage(this.tickets)
        }
        
        return ticket
      } catch (error) {
        console.error('Error al añadir etiqueta a ticket:', error)
        this.error = 'Error al añadir la etiqueta al ticket'
        throw error
      }
    },
    
    async removeTagFromTicket(ticketId: string, tagId: string) {
      try {
        // En un entorno real, esto haría una llamada a la API para eliminar una etiqueta de un ticket
        console.log('Eliminando etiqueta de ticket:', ticketId, tagId)
        
        // Buscar el ticket
        const ticketIndex = this.tickets.findIndex((ticket: Ticket) => ticket.id === ticketId)
        if (ticketIndex === -1) {
          throw new Error('Ticket no encontrado')
        }
        
        // Verificar si la etiqueta está en el ticket
        const ticket = this.tickets[ticketIndex]
        if (!ticket.tags) {
          return ticket
        }
        
        // Eliminar la etiqueta del ticket
        ticket.tags = ticket.tags.filter((tag: Tag | string) => 
          typeof tag === 'string' ? tag !== tagId : tag.id !== tagId
        )
        
        // Guarda los tickets en localStorage para persistir los cambios
        saveTicketsToStorage(this.tickets)
        
        return ticket
      } catch (error) {
        console.error('Error al eliminar etiqueta de ticket:', error)
        this.error = 'Error al eliminar la etiqueta del ticket'
        throw error
      }
    }
  }
})