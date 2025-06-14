package websocket

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/data"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/models"
)

// Upgrader para conexiones WebSocket
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Permitir todas las origenes para desarrollo
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// ChatHandlerWithStore maneja las conexiones WebSocket para el chat de tickets
// usando cualquier implementación de DataStore
func ChatHandlerWithStore(store data.DataStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extraer el ID del ticket desde la URL
		// Formato de URL: /api/ws/chat/:ticketID
		pathParts := strings.Split(r.URL.Path, "/")
		if len(pathParts) < 4 {
			http.Error(w, "URL de chat inválida", http.StatusBadRequest)
			return
		}

		ticketID := pathParts[len(pathParts)-1]
		fmt.Printf("Solicitud de conexión WebSocket para el ticket: %s\n", ticketID)

		// Verificar si el ticket existe
		ticket, err := store.GetTicket(ticketID)
		if err != nil {
			fmt.Printf("Error al buscar ticket %s: %v\n", ticketID, err)
			// En lugar de devolver un error, enviamos un mensaje simulado
			// para que el frontend pueda mostrar un modo de desarrollo
			conn, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				fmt.Printf("Error al actualizar a WebSocket: %v\n", err)
				return
			}

			// Enviar mensaje de modo desarrollo
			welcomeMsg := map[string]interface{}{
				"type": "connection_established",
				"data": map[string]interface{}{
					"id":        fmt.Sprintf("system-%d", time.Now().Unix()),
					"content":   "Modo desarrollo: WebSocket simulado",
					"isClient":  false,
					"timestamp": time.Now().Format(time.RFC3339),
					"mode":      "development",
				},
			}

			if err := conn.WriteJSON(welcomeMsg); err != nil {
				fmt.Printf("Error al enviar mensaje de desarrollo: %v\n", err)
			}

			// Mantener la conexión abierta pero en modo simulado
			handleSimulatedMessages(conn, ticketID)
			return
		}

		// Actualizar la conexión a WebSocket
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Printf("Error al actualizar a WebSocket: %v\n", err)
			return
		}

		// Enviar mensaje de bienvenida
		welcomeMsg := map[string]interface{}{
			"type": "connection_established",
			"data": map[string]interface{}{
				"id":        fmt.Sprintf("system-%d", time.Now().Unix()),
				"content":   "Conexión establecida",
				"isClient":  false,
				"timestamp": time.Now().Format(time.RFC3339),
			},
		}

		if err := conn.WriteJSON(welcomeMsg); err != nil {
			fmt.Printf("Error al enviar el mensaje de bienvenida: %v\n", err)
		}

		// Enviar historial de mensajes
		if ticket != nil && len(ticket.Messages) > 0 {
			historyMsg := map[string]interface{}{
				"type":     "message_history",
				"ticketId": ticketID,
				"messages": ticket.Messages,
			}

			if err := conn.WriteJSON(historyMsg); err != nil {
				fmt.Printf("Error al enviar el historial de mensajes: %v\n", err)
			}
		}

		// Manejar mensajes entrantes en una goroutine
		go handleIncomingMessages(conn, store, ticketID)
	}
}

// handleSimulatedMessages maneja una conexión WebSocket en modo simulado
func handleSimulatedMessages(conn *websocket.Conn, ticketID string) {
	defer conn.Close()

	// Configurar el manejador de ping
	conn.SetPingHandler(func(appData string) error {
		err := conn.WriteControl(websocket.PongMessage, []byte{}, time.Now().Add(10*time.Second))
		if err != nil {
			fmt.Printf("Error al enviar pong: %v\n", err)
			return err
		}
		return nil
	})

	// Mantener la conexión viva con pings
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
				fmt.Printf("Error al enviar ping: %v\n", err)
				return
			}
		}
	}()

	// Procesar mensajes entrantes
	for {
		// Leer mensaje
		_, data, err := conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				fmt.Printf("Error al leer mensaje: %v\n", err)
			}
			break
		}

		// Parsear mensaje
		var message struct {
			Type     string                 `json:"type"`
			TicketID string                 `json:"ticketId,omitempty"`
			UserID   string                 `json:"userId,omitempty"`
			Data     map[string]interface{} `json:"data,omitempty"`
			Content  string                 `json:"content,omitempty"`
			IsClient bool                   `json:"isClient,omitempty"`
		}

		if err := json.Unmarshal(data, &message); err != nil {
			fmt.Printf("Error al analizar mensaje: %v\n", err)
			continue
		}

		fmt.Printf("Mensaje simulado recibido: %s\n", string(data))

		// Para cualquier mensaje de tipo new_message, enviar una respuesta simulada
		if message.Type == "new_message" {
			// Extraer contenido del mensaje
			var content string
			if message.Data != nil && message.Data["content"] != nil {
				content = message.Data["content"].(string)
			} else {
				content = message.Content
			}

			// Crear respuesta simulada
			resp := map[string]interface{}{
				"type":     "message_received",
				"ticketId": ticketID,
				"data": map[string]interface{}{
					"id":        fmt.Sprintf("sim-%d", time.Now().UnixNano()),
					"content":   content,
					"isClient":  true,
					"timestamp": time.Now().Format(time.RFC3339),
					"userName":  "Usuario (Simulado)",
				},
			}

			// Enviar respuesta
			if err := conn.WriteJSON(resp); err != nil {
				fmt.Printf("Error al enviar respuesta simulada: %v\n", err)
			}

			// Simular respuesta del agente
			time.Sleep(1 * time.Second)
			agentResp := map[string]interface{}{
				"type":     "new_message",
				"ticketId": ticketID,
				"data": map[string]interface{}{
					"id":        fmt.Sprintf("agent-%d", time.Now().UnixNano()),
					"content":   "Este es un mensaje simulado del agente. El sistema está en modo desarrollo.",
					"isClient":  false,
					"timestamp": time.Now().Format(time.RFC3339),
					"userName":  "Agente (Simulado)",
				},
			}

			if err := conn.WriteJSON(agentResp); err != nil {
				fmt.Printf("Error al enviar respuesta del agente simulado: %v\n", err)
			}
		}
	}
}

// handleIncomingMessages procesa mensajes entrantes de WebSocket
func handleIncomingMessages(conn *websocket.Conn, store data.DataStore, ticketID string) {
	defer conn.Close()

	// Configurar el manejador de ping
	conn.SetPingHandler(func(appData string) error {
		err := conn.WriteControl(websocket.PongMessage, []byte{}, time.Now().Add(10*time.Second))
		if err != nil {
			fmt.Printf("Error al enviar pong: %v\n", err)
			return err
		}
		return nil
	})

	// Mantener la conexión viva con pings
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
				fmt.Printf("Error al enviar ping: %v\n", err)
				return
			}
		}
	}()

	// Procesar mensajes entrantes
	for {
		// Leer mensaje
		_, data, err := conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				fmt.Printf("Error al leer mensaje: %v\n", err)
			}
			break
		}

		// Parsear mensaje
		var message struct {
			Type     string                 `json:"type"`
			TicketID string                 `json:"ticketId,omitempty"`
			UserID   string                 `json:"userId,omitempty"`
			Data     map[string]interface{} `json:"data,omitempty"`
			Content  string                 `json:"content,omitempty"`
			IsClient bool                   `json:"isClient,omitempty"`
		}

		if err := json.Unmarshal(data, &message); err != nil {
			fmt.Printf("Error al analizar mensaje: %v\n", err)
			continue
		}

		fmt.Printf("Mensaje recibido: %s\n", string(data))

		// Manejar mensaje basado en el tipo
		switch message.Type {
		case "new_message":
			// Extraer contenido del mensaje
			var content string
			var isClient bool
			var userName string

			if message.Data != nil {
				// Intentar extraer del campo de datos
				if c, ok := message.Data["content"].(string); ok {
					content = c
				}
				if ic, ok := message.Data["isClient"].(bool); ok {
					isClient = ic
				}
				if un, ok := message.Data["userName"].(string); ok {
					userName = un
				}
			} else {
				// Campos directos
				content = message.Content
				isClient = message.IsClient
			}

			// Validar contenido
			if content == "" {
				continue
			}

			// Crear objeto de mensaje
			newMessage := models.Message{
				ID:        fmt.Sprintf("MSG-%s", time.Now().Format("20060102150405.000")),
				Content:   content,
				IsClient:  isClient,
				Timestamp: time.Now(),
				CreatedAt: time.Now(),
				UserName:  userName,
			}

			// Agregar mensaje al ticket
			err := store.AddTicketMessage(ticketID, newMessage)
			if err != nil {
				fmt.Printf("Error agregando mensaje al ticket: %v\n", err)
				continue
			}

			// Enviar confirmación
			resp := map[string]interface{}{
				"type":     "message_received",
				"ticketId": ticketID,
				"data":     newMessage,
			}

			if err := conn.WriteJSON(resp); err != nil {
				fmt.Printf("Error al enviar la confirmación de mensaje: %v\n", err)
			}

			// No podemos hacer broadcast con la interfaz DataStore
			// Esto requeriría extender la interfaz
		}
	}
}

// ChatHandler maneja las conexiones WebSocket para el chat de tickets
func ChatHandler(store data.DataStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extraer el ID del ticket desde la URL
		// Formato de URL: /api/ws/chat/:ticketID
		pathParts := strings.Split(r.URL.Path, "/")
		if len(pathParts) < 4 {
			http.Error(w, "URL de chat inválida", http.StatusBadRequest)
			return
		}

		ticketID := pathParts[len(pathParts)-1]
		fmt.Printf("Solicitud de conexión WebSocket para el ticket: %s\n", ticketID)

		// Verificar si el ticket existe
		ticket, err := store.GetTicket(ticketID)
		if err != nil {
			http.Error(w, "Ticket no encontrado", http.StatusNotFound)
			return
		}

		// Actualizar la conexión a WebSocket
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Printf("Error al actualizar a WebSocket: %v\n", err)
			return
		}

		// Agregar la conexión al almacén
		connectionID := store.AddWSConnection(ticketID, conn)

		// Enviar mensaje de bienvenida
		welcomeMsg := models.WebSocketMessage{
			Type: "connection_established",
			Data: map[string]interface{}{
				"id":        fmt.Sprintf("system-%d", time.Now().Unix()),
				"content":   "Conexión establecida",
				"isClient":  false,
				"timestamp": time.Now(),
			},
		}

		if err := conn.WriteJSON(welcomeMsg); err != nil {
			fmt.Printf("Error al enviar el mensaje de bienvenida: %v\n", err)
		}

		// Enviar historial de mensajes
		if ticket != nil && len(ticket.Messages) > 0 {
			historyMsg := models.WebSocketMessage{
				Type:     "message_history",
				TicketID: ticketID,
				Messages: ticket.Messages,
			}

			if err := conn.WriteJSON(historyMsg); err != nil {
				fmt.Printf("Error al enviar el historial de mensajes: %v\n", err)
			}
		}

		// Manejar mensajes entrantes en una goroutine
		go handleMessages(conn, store, ticketID, connectionID)
	}
}

// handleMessages procesa mensajes entrantes de WebSocket
func handleMessages(conn *websocket.Conn, store data.DataStore, ticketID, connectionID string) {
	defer func() {
		conn.Close()
		store.RemoveWSConnection(ticketID, connectionID)
		fmt.Printf("Conexión WebSocket cerrada para el ticket: %s\n", ticketID)
	}()

	// Configurar el manejador de ping
	conn.SetPingHandler(func(appData string) error {
		err := conn.WriteControl(websocket.PongMessage, []byte{}, time.Now().Add(10*time.Second))
		if err != nil {
			fmt.Printf("Error al enviar pong: %v\n", err)
			return err
		}
		return nil
	})

	// Mantener la conexión viva con pings
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
				fmt.Printf("Error al enviar ping: %v\n", err)
				return
			}
		}
	}()

	// Procesar mensajes entrantes
	for {
		// Leer mensaje
		_, data, err := conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				fmt.Printf("Error al leer mensaje: %v\n", err)
			}
			break
		}

		// Parsear mensaje
		var message struct {
			Type     string                 `json:"type"`
			TicketID string                 `json:"ticketId,omitempty"`
			UserID   string                 `json:"userId,omitempty"`
			Data     map[string]interface{} `json:"data,omitempty"`
			Content  string                 `json:"content,omitempty"`
			IsClient bool                   `json:"isClient,omitempty"`
		}

		if err := json.Unmarshal(data, &message); err != nil {
			fmt.Printf("Error al analizar mensaje: %v\n", err)
			continue
		}

		fmt.Printf("Mensaje recibido: %s\n", string(data))

		// Manejar mensaje basado en el tipo
		switch message.Type {
		case "identify":
			// El cliente está identificándose
			resp := models.WebSocketMessage{
				Type:     "identify_success",
				TicketID: ticketID,
				Data: map[string]interface{}{
					"message": "Identificación exitosa",
					"userId":  message.UserID,
				},
			}

			if err := conn.WriteJSON(resp); err != nil {
				fmt.Printf("Error al enviar la respuesta de identificación: %v\n", err)
			}

		case "new_message":
			// Extraer contenido del mensaje
			var content string
			var isClient bool
			var userName string

			if message.Data != nil {
				// Intentar extraer del campo de datos
				if c, ok := message.Data["content"].(string); ok {
					content = c
				}
				if ic, ok := message.Data["isClient"].(bool); ok {
					isClient = ic
				}
				if un, ok := message.Data["userName"].(string); ok {
					userName = un
				}
			} else {
				// Campos directos
				content = message.Content
				isClient = message.IsClient
			}

			// Validar contenido
			if content == "" {
				continue
			}

			// Crear objeto de mensaje
			newMessage := models.Message{
				ID:        fmt.Sprintf("MSG-%s", time.Now().Format("20060102150405.000")),
				Content:   content,
				IsClient:  isClient,
				Timestamp: time.Now(),
				CreatedAt: time.Now(),
				UserName:  userName,
			}

			// Agregar mensaje al ticket
			err := store.AddTicketMessage(ticketID, newMessage)
			if err != nil {
				fmt.Printf("Error agregando mensaje al ticket: %v\n", err)
				continue
			}

			// Enviar confirmación
			resp := models.WebSocketMessage{
				Type:     "message_received",
				TicketID: ticketID,
				Data:     newMessage,
			}

			if err := conn.WriteJSON(resp); err != nil {
				fmt.Printf("Error al enviar la confirmación de mensaje: %v\n", err)
			}

			// Broadcast a todos los clientes
			store.BroadcastMessage(ticketID, newMessage)
		}
	}
}
