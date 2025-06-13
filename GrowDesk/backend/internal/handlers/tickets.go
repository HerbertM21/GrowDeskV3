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
	// Esta función solo maneja solicitudes POST
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Establecer CORS
	utils.SetCORS(w)

	// Obtener ID de usuario del contexto
	userID := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	// Decodificar cuerpo de la solicitud
	var ticketReq models.TicketRequest
	if err := utils.DecodeJSON(r, &ticketReq); err != nil {
		http.Error(w, "Error al leer datos del ticket", http.StatusBadRequest)
		return
	}

	// Validar campos requeridos
	if ticketReq.Title == "" || ticketReq.Description == "" || ticketReq.CategoryID == "" {
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

	// Agregar ticket al almacén
	if err := h.Store.CreateTicket(newTicket); err != nil {
		http.Error(w, "Error al crear ticket", http.StatusInternalServerError)
		return
	}

	// Devolver ticket creado
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

// CreateWidgetTicket crea un nuevo ticket desde el widget
func (h *TicketHandler) CreateWidgetTicket(w http.ResponseWriter, r *http.Request) {
	// Solo maneja solicitudes POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Log para depuración
	body, _ := io.ReadAll(r.Body)
	r.Body = io.NopCloser(bytes.NewBuffer(body))
	fmt.Printf("Recibido del widget: %s\n", string(body))

	// Estructura para recibir el formato específico del widget
	var widgetRequest struct {
		ID          string                 `json:"id"`
		Title       string                 `json:"title"`
		Subject     string                 `json:"subject"`
		Description string                 `json:"description"`
		Status      string                 `json:"status"`
		Priority    string                 `json:"priority"`
		Email       string                 `json:"email"`
		Name        string                 `json:"name"`
		ClientName  string                 `json:"clientName"`
		ClientEmail string                 `json:"clientEmail"`
		Department  string                 `json:"department"`
		Source      string                 `json:"source"`
		WidgetID    string                 `json:"widgetId"`
		CreatedAt   string                 `json:"createdAt"`
		Metadata    map[string]interface{} `json:"metadata"`
	}

	// Intentar decodificar primero con el formato del widget
	if err := json.Unmarshal(body, &widgetRequest); err != nil {
		fmt.Printf("Error al decodificar la solicitud del widget: %v\n", err)
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validaciones básicas
	if widgetRequest.Subject == "" && widgetRequest.Title == "" {
		fmt.Printf("Error: Solicitud sin título o asunto\n")
		http.Error(w, "Subject or title is required", http.StatusBadRequest)
		return
	}

	// Establecer valores por defecto si están vacíos
	if widgetRequest.Status == "" {
		widgetRequest.Status = "open"
	}

	if widgetRequest.Priority == "" {
		widgetRequest.Priority = "medium"
	}

	if widgetRequest.Department == "" {
		widgetRequest.Department = "soporte"
	}

	if widgetRequest.Source == "" {
		widgetRequest.Source = "widget"
	}

	// Usar nombre del cliente para completar campos si están vacíos
	name := widgetRequest.Name
	if name == "" {
		name = widgetRequest.ClientName
		if name == "" {
			name = "Anónimo"
		}
	}

	email := widgetRequest.Email
	if email == "" {
		email = widgetRequest.ClientEmail
		if email == "" {
			email = "anonymous@example.com"
		}
	}

	// Usar ID proporcionado o generar uno nuevo
	ticketID := widgetRequest.ID
	if ticketID == "" {
		ticketID = utils.GenerateTicketID()
	}

	// Fecha de creación
	now := time.Now()
	createdAt := now
	if widgetRequest.CreatedAt != "" {
		parsedTime, err := time.Parse(time.RFC3339, widgetRequest.CreatedAt)
		if err == nil {
			createdAt = parsedTime
		}
	}

	// Determinar el título para mantener consistencia
	title := widgetRequest.Title
	if title == "" {
		title = widgetRequest.Subject
	}

	// Crear metadata para el ticket
	var ticketMetadata *models.Metadata
	if widgetRequest.Metadata != nil {
		ticketMetadata = &models.Metadata{
			URL:       utils.GetStringFromMap(widgetRequest.Metadata, "url"),
			UserAgent: utils.GetStringFromMap(widgetRequest.Metadata, "userAgent"),
			Referrer:  utils.GetStringFromMap(widgetRequest.Metadata, "referrer"),
		}
	}

	// Crear el mensaje inicial
	initialMessage := models.Message{
		ID:        utils.GenerateMessageID(),
		Content:   widgetRequest.Description,
		IsClient:  true,
		Timestamp: createdAt,
		CreatedAt: createdAt,
		UserName:  name,
		UserEmail: email,
	}

	// Verificar si existe un usuario con este email para evitar violar la restricción foreign key
	var userID string = ""
	fmt.Printf("Buscando usuario con email: %s\n", email)
	existingUser, userErr := h.Store.GetUserByEmail(email)
	if userErr == nil && existingUser != nil {
		// Si existe un usuario con este email, usar su ID
		userID = existingUser.ID
		fmt.Printf("Se encontró usuario existente con email %s, ID: %s\n", email, userID)
	} else {
		fmt.Printf("No se encontró usuario con email %s, error: %v\n", email, userErr)
		// No hay usuario existente con este email, verificamos el usuario del sistema
		systemUser, sysErr := h.Store.GetUserByEmail("admin@growdesk.com")
		if sysErr == nil && systemUser != nil {
			userID = systemUser.ID
			fmt.Printf("Usando usuario del sistema con ID: %s\n", userID)
		} else {
			fmt.Printf("No se encontró usuario del sistema. Error: %v\n", sysErr)
			// Crear un ticket sin UserID para evitar violación de clave foránea
			fmt.Printf("Creando ticket sin UserID para evitar restricciones de clave foránea\n")
		}
	}

	// Crear objeto de ticket para PostgreSQL
	ticket := models.Ticket{
		ID:          ticketID,
		Title:       title,
		Subject:     widgetRequest.Subject,
		Status:      widgetRequest.Status,
		CreatedAt:   createdAt,
		UpdatedAt:   now,
		Description: widgetRequest.Description,
		Priority:    widgetRequest.Priority,
		Category:    widgetRequest.Department,
		Department:  widgetRequest.Department,
		// Solo usar UserID si tenemos uno válido
		UserID: userID,
		// Para tickets del widget, CreatedBy es el email del cliente
		CreatedBy: email,
		Source:    widgetRequest.Source,
		WidgetID:  widgetRequest.WidgetID,
		Customer: models.Customer{
			Name:  name,
			Email: email,
		},
		Messages: []models.Message{initialMessage},
		Metadata: ticketMetadata,
	}

	fmt.Printf("Intentando guardar ticket en base de datos: %+v\n", ticket)
	fmt.Printf("UserID asignado: '%s'\n", userID)

	// Almacenar en la base de datos
	err := h.Store.CreateTicket(ticket)
	if err != nil {
		fmt.Printf("ERROR AL GUARDAR TICKET EN LA BASE DE DATOS: %v\n", err)
		fmt.Printf("Detalles del ticket que no se pudo guardar: ID=%s, Title=%s, UserID=%s\n", ticket.ID, ticket.Title, ticket.UserID)

		// Intentar verificar si el ticket ya existe
		existingTicket, checkErr := h.Store.GetTicket(ticketID)
		if checkErr != nil {
			fmt.Printf("El ticket no existe previamente en la base de datos: %v\n", checkErr)
		} else {
			fmt.Printf("ALERTA: El ticket ya existe en la base de datos: %+v\n", existingTicket)
		}

		http.Error(w, "Error creating ticket: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Confirmar la creación y loguear para depuración
	fmt.Printf("Ticket %s guardado correctamente en la base de datos\n", ticketID)

	// Verificar que el ticket se guardó correctamente
	verifiedTicket, verifyErr := h.Store.GetTicket(ticketID)
	if verifyErr != nil {
		fmt.Printf("ALERTA: No se pudo verificar el ticket recién creado: %v\n", verifyErr)
	} else {
		fmt.Printf("Verificación exitosa - Ticket recuperado de la base de datos: %+v\n", verifiedTicket)
	}

	// Devolver respuesta de éxito con el formato que el widget espera
	response := map[string]interface{}{
		"success":           true,
		"ticketId":          ticketID,
		"id":                ticketID,
		"liveChatAvailable": true,
		"message":           "Ticket creado correctamente",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// AssignTicket asigna un ticket a un usuario específico
func (h *TicketHandler) AssignTicket(w http.ResponseWriter, r *http.Request) {
	// Solo maneja solicitudes POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Establecer CORS
	utils.SetCORS(w)

	// Extraer el ID del ticket desde la URL
	// Formato de URL: /api/tickets/:id/assign
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "ID de ticket inválido", http.StatusBadRequest)
		return
	}

	ticketID := parts[len(parts)-2] // El ID está antes de "assign"

	// Parsear el cuerpo de la solicitud
	var assignReq struct {
		AssignedTo string `json:"assignedTo"`
		Status     string `json:"status,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&assignReq); err != nil {
		http.Error(w, "El cuerpo de la solicitud es inválido", http.StatusBadRequest)
		return
	}

	// Validar que se proporcionó el ID del usuario asignado
	if assignReq.AssignedTo == "" {
		http.Error(w, "Se requiere el ID del usuario asignado", http.StatusBadRequest)
		return
	}

	// Verificar que el usuario existe
	_, err := h.Store.GetUser(assignReq.AssignedTo)
	if err != nil {
		http.Error(w, "Usuario no encontrado", http.StatusNotFound)
		return
	}

	// Obtener el ticket existente
	ticket, err := h.Store.GetTicket(ticketID)
	if err != nil {
		http.Error(w, "Ticket no encontrado", http.StatusNotFound)
		return
	}

	// Actualizar el ticket con la asignación
	ticket.AssignedTo = assignReq.AssignedTo

	// Si se proporciona un nuevo estado, actualizarlo; si no, usar "assigned"
	if assignReq.Status != "" {
		ticket.Status = assignReq.Status
	} else {
		ticket.Status = "assigned"
	}

	ticket.UpdatedAt = time.Now()

	// Guardar en el almacén
	if err := h.Store.UpdateTicket(*ticket); err != nil {
		http.Error(w, "Error al asignar ticket", http.StatusInternalServerError)
		return
	}

	// Devolver ticket actualizado
	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Ticket asignado correctamente",
		"ticket":  ticket,
	})
}
