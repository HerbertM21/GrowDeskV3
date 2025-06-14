import apiClient from '../api/client';
import type { Ticket } from '../stores/tickets';

// INTERFAZ PARA CREAR EL TICKET
export interface TicketCreateData {
  title: string;
  description: string;
  priority: Ticket['priority'];
  category: string;
}

// INTERFAZ PARA UPDATE TICKET
export interface TicketUpdateData extends Partial<Ticket> {}

// API 
const ticketService = {

  async getAllTickets(): Promise<Ticket[]> {
    try {
      console.log('📡 Llamando API para obtener todos los tickets');
      const response = await apiClient.get('/tickets');
      
      if (!response.data) {
        console.error('❌ La respuesta de la API no contiene datos');
        return [];
      }
      
      if (!Array.isArray(response.data)) {
        console.error('❌ La respuesta de la API no es un array:', response.data);
        return [];
      }
      
      console.log(`✅ Obtenidos ${response.data.length} tickets del servidor`);
      return response.data;
    } catch (error) {
      console.error('❌ Error al obtener tickets:', error);
      return [];
    }
  },

  async getUserTickets(userId: string): Promise<Ticket[]> {
    try {
      console.log(`📡 Obteniendo tickets para el usuario ${userId}`);
      const response = await apiClient.get(`/tickets/user/${userId}`);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.warn('⚠️ Sin respuesta válida de la API para tickets del usuario');
        return [];
      }
      
      console.log(`✅ Obtenidos ${response.data.length} tickets para el usuario ${userId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error al obtener tickets del usuario ${userId}:`, error);
      return [];
    }
  },

  async getTicket(id: string): Promise<Ticket> {
    try {
      console.log(`📡 Obteniendo ticket con ID: ${id}`);
      const response = await apiClient.get(`/tickets/${id}`);
      
      if (!response.data) {
        throw new Error(`No se encontró el ticket con ID ${id}`);
      }
      
      console.log(`✅ Ticket ${id} obtenido correctamente`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error al obtener ticket ${id}:`, error);
      throw error;
    }
  },

  async createTicket(ticketData: TicketCreateData): Promise<Ticket> {
    try {
      console.log('📡 Creando nuevo ticket:', ticketData);
      const response = await apiClient.post('/tickets', ticketData);
      console.log('✅ Ticket creado correctamente:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error al crear ticket:', error);
      throw error;
    }
  },

  async updateTicket(id: string, ticketData: TicketUpdateData): Promise<Ticket> {
    try {
      console.log(`📡 Actualizando ticket ${id}:`, ticketData);
      const response = await apiClient.put(`/tickets/${id}`, ticketData);
      console.log(`✅ Ticket ${id} actualizado correctamente:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`❌ Error al actualizar ticket ${id}:`, error);
      throw error;
    }
  },

  async deleteTicket(id: string): Promise<void> {
    try {
      console.log(`📡 Eliminando ticket ${id}`);
      await apiClient.delete(`/tickets/${id}`);
      console.log(`✅ Ticket ${id} eliminado correctamente`);
    } catch (error) {
      console.error(`❌ Error al eliminar ticket ${id}:`, error);
      throw error;
    }
  },

  async updateTicketPriority(id: string, priority: string): Promise<Ticket> {
    try {
      console.log(`📡 Actualizando prioridad del ticket ${id} a ${priority}`);
      // Usar el método updateTicket pero solo con el campo priority
      const response = await apiClient.put(`/tickets/${id}`, { priority });
      console.log(`✅ Prioridad del ticket ${id} actualizada correctamente a ${priority}:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`❌ Error al actualizar prioridad del ticket ${id}:`, error);
      throw error;
    }
  },

  async assignTicket(id: string, userId: string): Promise<Ticket> {
    try {
      console.log(`📡 Asignando ticket ${id} al usuario ${userId}`);
      const response = await apiClient.post(`/tickets/${id}/assign`, { 
        assignedTo: userId,
        status: 'assigned'
      });
      console.log(`✅ Ticket ${id} asignado correctamente al usuario ${userId}`);
      return response.data.ticket || response.data;
    } catch (error) {
      console.error(`❌ Error al asignar ticket ${id} al usuario ${userId}:`, error);
      throw error;
    }
  },

  async updateTicketStatus(id: string, status: Ticket['status']): Promise<Ticket> {
    try {
      console.log(`📡 Actualizando estado del ticket ${id} a ${status}`);
      const response = await apiClient.put(`/tickets/${id}/status`, { status });
      console.log(`✅ Estado del ticket ${id} actualizado correctamente a ${status}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error al actualizar estado del ticket ${id}:`, error);
      throw error;
    }
  }
};

export default ticketService; 