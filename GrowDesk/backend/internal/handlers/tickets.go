package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/data"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/middleware"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/models"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/utils"
)

// TicketHandler contiene manejadores para operaciones de tickets
type TicketHandler struct {
	Store data.DataStore
}

// GetAllTickets maneja la obtención de todos los tickets
func (h *TicketHandler) GetAllTickets(w http.ResponseWriter, r *http.Request) {
	// Esta función solo maneja solicitudes GET
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Establecer CORS
	utils.SetCORS(w)

	// Obtener tickets del almacén
	tickets, err := h.Store.GetTickets()
	if err != nil {
		http.Error(w, "Error al obtener tickets", http.StatusInternalServerError)
		return
	}

	// Devolver tickets como JSON
	utils.WriteJSON(w, http.StatusOK, tickets)
}

// GetTicket devuelve un ticket específico por ID
func (h *TicketHandler) GetTicket(w http.ResponseWriter, r *http.Request) {
	// Solo maneja solicitudes GET
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Extraer el ID del ticket desde la URL
	// Formato de URL: /api/tickets/:id
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 3 {
		http.Error(w, "ID de ticket inválido", http.StatusBadRequest)
		return
	}

	ticketID := parts[len(parts)-1]

	// Obtener el ticket
	ticket, err := h.Store.GetTicket(ticketID)
	if err != nil {
		http.Error(w, "Ticket no encontrado", http.StatusNotFound)
		return
	}

	// Devolver el ticket
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ticket)
}

// CreateTicket maneja la creación de un nuevo ticket
func (h *TicketHandler) CreateTicket(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("🚀 HANDLER CreateTicket INICIADO - URL: %s, Método: %s\n", r.URL.Path, r.Method)

	// Esta función solo maneja solicitudes POST
	if r.Method != http.MethodPost {
		fmt.Printf("❌ Error: Método no permitido: %s\n", r.Method)
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Establecer CORS
	utils.SetCORS(w)

	// Obtener ID de usuario del contexto
	userID := r.Context().Value(middleware.UserIDKey).(string)
	fmt.Printf("🔑 UserID obtenido del contexto: %s\n", userID)
	if userID == "" {
		fmt.Printf("❌ Error: UserID vacío\n")
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	// Decodificar cuerpo de la solicitud
	var ticketReq models.TicketRequest
	if err := utils.DecodeJSON(r, &ticketReq); err != nil {
		fmt.Printf("❌ Error al decodificar JSON: %v\n", err)
		http.Error(w, "Error al leer datos del ticket", http.StatusBadRequest)
		return
	}

	fmt.Printf("📝 Datos del ticket recibidos: Title=%s, Description=%s, CategoryID=%s, Priority=%s\n",
		ticketReq.Title, ticketReq.Description, ticketReq.CategoryID, ticketReq.Priority)

	// Validar campos requeridos
	if ticketReq.Title == "" || ticketReq.Description == "" || ticketReq.CategoryID == "" {
		fmt.Printf("❌ Error: Campos requeridos faltantes - Title=%s, Description=%s, CategoryID=%s\n",
			ticketReq.Title, ticketReq.Description, ticketReq.CategoryID)
		http.Error(w, "Título, descripción y categoría son requeridos", http.StatusBadRequest)
		return
	}

	// Crear mensaje inicial
	initialMessage := models.Message{
		ID:        uuid.New().String(),
		Content:   ticketReq.Description,
		UserID:    userID,
		UserName:  ticketReq.UserName,
		IsClient:  ticketReq.IsClient,
		Timestamp: time.Now(),
		CreatedAt: time.Now(),
	}
	fmt.Printf("💬 Mensaje inicial creado: ID=%s, Content=%s\n", initialMessage.ID, initialMessage.Content)

	// Crear nuevo ticket
	newTicket := models.Ticket{
		ID:          fmt.Sprintf("TICKET-%s", time.Now().Format("20060102-150405")),
		Title:       ticketReq.Title,
		Description: ticketReq.Description,
		CategoryID:  ticketReq.CategoryID,
		Status:      "open",
		Priority:    ticketReq.Priority,
		UserID:      userID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Messages:    []models.Message{initialMessage},
		Metadata:    ticketReq.Metadata,
	}
	fmt.Printf("🎫 Ticket creado: ID=%s, Title=%s\n", newTicket.ID, newTicket.Title)

	// Agregar ticket al almacén
	fmt.Printf("💾 Intentando guardar ticket en el almacén...\n")
	if err := h.Store.CreateTicket(newTicket); err != nil {
		fmt.Printf("❌ Error al crear ticket en el almacén: %v\n", err)
		http.Error(w, fmt.Sprintf("Error al crear ticket: %v", err), http.StatusInternalServerError)
		return
	}
	fmt.Printf("✅ Ticket guardado exitosamente en el almacén\n")

	// Devolver ticket creado
	fmt.Printf("📤 Enviando respuesta exitosa\n")
	utils.WriteJSON(w, http.StatusCreated, newTicket)
}

// UpdateTicket maneja la actualización de un ticket existente
func (h *TicketHandler) UpdateTicket(w http.ResponseWriter, r *http.Request) {
	// Solo maneja solicitudes PUT
	if r.Method != http.MethodPut {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Establecer CORS
	utils.SetCORS(w)

	// Obtener ID del ticket de la URL
	path := r.URL.Path
	segments := strings.Split(path, "/")
	if len(segments) < 4 {
		http.Error(w, "URL de ticket inválida", http.StatusBadRequest)
		return
	}

	ticketID := segments[3]

	// Obtener el ticket existente
	ticket, err := h.Store.GetTicket(ticketID)
	if err != nil {
		http.Error(w, "Ticket no encontrado", http.StatusNotFound)
		return
	}

	// Decodificar cuerpo de la solicitud
	var updates models.TicketUpdateRequest
	if err := utils.DecodeJSON(r, &updates); err != nil {
		http.Error(w, "Error al leer datos de actualización", http.StatusBadRequest)
		return
	}

	// Actualizar los campos del ticket
	if updates.Status != "" {
		ticket.Status = updates.Status
	}
	if updates.Priority != "" {
		ticket.Priority = updates.Priority
	}
	if updates.AssignedTo != "" {
		ticket.AssignedTo = updates.AssignedTo
	}
	if updates.Category != "" {
		ticket.Category = updates.Category
	}
	if updates.Department != "" {
		ticket.Department = updates.Department
	}
	if updates.Subject != "" {
		ticket.Subject = updates.Subject
	}

	// Actualizar timestamp
	ticket.UpdatedAt = time.Now()

	// Guardar en el almacén
	if err := h.Store.UpdateTicket(*ticket); err != nil {
		http.Error(w, "Error al actualizar ticket", http.StatusInternalServerError)
		return
	}

	// Devolver ticket actualizado
	utils.WriteJSON(w, http.StatusOK, ticket)
}

// GetTicketMessages devuelve mensajes para un ticket específico
func (h *TicketHandler) GetTicketMessages(w http.ResponseWriter, r *http.Request) {
	// Solo maneja solicitudes GET
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Extraer el ID del ticket desde la URL
	// Formato de URL: /api/tickets/:id/messages
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "ID de ticket inválido", http.StatusBadRequest)
		return
	}

	// Obtener el ID desde la URL (asumiendo formato /tickets/ID/messages)
	ticketID := parts[len(parts)-2]

	// Obtener el ticket
	ticket, err := h.Store.GetTicket(ticketID)
	if err != nil {
		http.Error(w, "Ticket no encontrado", http.StatusNotFound)
		return
	}

	// Devolver los mensajes
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ticket.Messages)
}

// AddTicketMessage añade un nuevo mensaje a un ticket existente
func (h *TicketHandler) AddTicketMessage(w http.ResponseWriter, r *http.Request) {
	// DEBUG: Log al inicio del handler
	fmt.Printf("🚀 HANDLER AddTicketMessage INICIADO - URL: %s, Método: %s\n", r.URL.Path, r.Method)

	// Solo maneja solicitudes POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extraer el ID del ticket desde la URL
	// Formato de URL: /api/tickets/:id/messages
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "ID de ticket inválido", http.StatusBadRequest)
		return
	}

	// Obtener el ID desde la URL (asumiendo formato /tickets/ID/messages)
	ticketID := parts[len(parts)-2]

	// Parsear el cuerpo de la solicitud
	var messageReq models.NewMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&messageReq); err != nil {
		http.Error(w, "El cuerpo de la solicitud es inválido", http.StatusBadRequest)
		return
	}

	// Determinar el contenido del mensaje (compatibilidad con widget-api)
	content := messageReq.Content
	if content == "" {
		// Si no hay contenido, usar el campo Content directamente
		content = messageReq.Content
	}

	// Validar contenido
	if content == "" {
		http.Error(w, "El contenido del mensaje es requerido", http.StatusBadRequest)
		return
	}

	// Crear nuevo mensaje
	message := models.Message{
		ID:        utils.GenerateMessageID(),
		Content:   content, // Usar el contenido determinado
		IsClient:  messageReq.IsClient,
		Timestamp: time.Now(),
		CreatedAt: time.Now(),
		UserName:  messageReq.UserName,
		UserEmail: messageReq.UserEmail,
	}

	// Agregar mensaje al ticket
	if err := h.Store.AddTicketMessage(ticketID, message); err != nil {
		http.Error(w, "Failed to add message: "+err.Error(), http.StatusBadRequest)
		return
	}

	// DEBUG: Log antes de BroadcastMessage
	fmt.Printf("🔄 LLAMANDO A BroadcastMessage para ticket %s con mensaje: %s\n", ticketID, message.Content)

	// Broadcast a los clientes WebSocket
	h.Store.BroadcastMessage(ticketID, message)

	// DEBUG: Log después de BroadcastMessage
	fmt.Printf("✅ BroadcastMessage completado para ticket %s\n", ticketID)

	// Devolver respuesta de éxito
	response := struct {
		Success bool           `json:"success"`
		Message string         `json:"message"`
		Data    models.Message `json:"data"`
	}{
		Success: true,
		Message: "Message added successfully",
		Data:    message,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// CreateWidgetTicket maneja la creación de tickets desde el widget de soporte
func (h *TicketHandler) AssignTicket(w http.ResponseWriter, r *http.Request) {
	fmt.Println("=== INICIANDO ASIGNACIÓN DE TICKET ===")
	fmt.Printf("URL: %s, Método: %s\n", r.URL.Path, r.Method)

	// Solo maneja solicitudes POST
	if r.Method != http.MethodPost {
		fmt.Println("Error: Método no permitido")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Establecer CORS
	utils.SetCORS(w)

	// Extraer el ID del ticket desde la URL
	// Formato de URL: /api/tickets/:id/assign
	parts := strings.Split(r.URL.Path, "/")
	fmt.Printf("Partes de la URL: %v\n", parts)

	// Buscar el índice de "tickets" en la URL
	ticketIndex := -1
	for i, part := range parts {
		if part == "tickets" && i < len(parts)-2 {
			ticketIndex = i
			break
		}
	}

	if ticketIndex == -1 || ticketIndex+1 >= len(parts) {
		fmt.Println("Error: No se pudo encontrar el patrón 'tickets/:id' en la URL")
		http.Error(w, "URL mal formada", http.StatusBadRequest)
		return
	}

	ticketID := parts[ticketIndex+1]
	fmt.Printf("ID del ticket extraído: %s\n", ticketID)

	if ticketID == "" || ticketID == "assign" {
		fmt.Println("Error: ID de ticket inválido")
		http.Error(w, "ID de ticket inválido", http.StatusBadRequest)
		return
	}

	// Parsear el cuerpo de la solicitud
	var assignReq struct {
		AssignedTo string `json:"assignedTo"`
		Status     string `json:"status,omitempty"`
	}

	// Log del cuerpo de la solicitud
	body, _ := io.ReadAll(r.Body)
	r.Body = io.NopCloser(bytes.NewBuffer(body))
	fmt.Printf("Cuerpo de la solicitud: %s\n", string(body))

	if err := json.NewDecoder(r.Body).Decode(&assignReq); err != nil {
		fmt.Printf("Error al decodificar el cuerpo: %v\n", err)
		http.Error(w, "El cuerpo de la solicitud es inválido", http.StatusBadRequest)
		return
	}

	fmt.Printf("Datos decodificados: assignedTo=%s, status=%s\n", assignReq.AssignedTo, assignReq.Status)

	// Validar que se proporcionó el ID del usuario asignado
	if assignReq.AssignedTo == "" {
		fmt.Println("Error: No se proporcionó ID de usuario para asignar")
		http.Error(w, "Se requiere el ID del usuario asignado", http.StatusBadRequest)
		return
	}

	// Verificar que el usuario existe
	fmt.Printf("Buscando usuario con ID: %s\n", assignReq.AssignedTo)
	user, err := h.Store.GetUser(assignReq.AssignedTo)
	if err != nil {
		fmt.Printf("Error al buscar usuario: %v\n", err)
		http.Error(w, "Usuario no encontrado", http.StatusNotFound)
		return
	}
	fmt.Printf("Usuario encontrado: %s %s (ID: %s)\n", user.FirstName, user.LastName, user.ID)

	// Obtener el ticket existente
	fmt.Printf("Buscando ticket con ID: %s\n", ticketID)
	ticket, err := h.Store.GetTicket(ticketID)
	if err != nil {
		fmt.Printf("Error al buscar ticket: %v\n", err)
		http.Error(w, "Ticket no encontrado", http.StatusNotFound)
		return
	}
	fmt.Printf("Ticket encontrado: %s (ID: %s)\n", ticket.Title, ticket.ID)

	// Actualizar el ticket con la asignación
	fmt.Printf("Actualizando ticket: Asignando de '%s' a '%s'\n", ticket.AssignedTo, assignReq.AssignedTo)
	ticket.AssignedTo = assignReq.AssignedTo

	// Si se proporciona un nuevo estado, actualizarlo; si no, usar "assigned"
	if assignReq.Status != "" {
		ticket.Status = assignReq.Status
	} else {
		ticket.Status = "assigned"
	}
	fmt.Printf("Estado del ticket actualizado a: %s\n", ticket.Status)

	ticket.UpdatedAt = time.Now()

	// Guardar en el almacén
	fmt.Printf("Guardando ticket actualizado en la base de datos...\n")
	if err := h.Store.UpdateTicket(*ticket); err != nil {
		fmt.Printf("Error al actualizar ticket en base de datos: %v\n", err)
		http.Error(w, "Error al asignar ticket", http.StatusInternalServerError)
		return
	}
	fmt.Println("Ticket actualizado exitosamente en la base de datos")

	// Devolver ticket actualizado
	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Ticket asignado correctamente",
		"ticket":  ticket,
	})
	fmt.Println("=== ASIGNACIÓN DE TICKET COMPLETADA ===")
}
