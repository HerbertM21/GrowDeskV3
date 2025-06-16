package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/data"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/db"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/handlers"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/middleware"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/models"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/utils"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/websocket"
	"github.com/joho/godotenv"
)

func main() {
	fmt.Printf("🚀 INICIANDO APLICACIÓN - MAIN FUNCTION\n")
	// Cargar variables de entorno desde .env
	err := godotenv.Load()
	if err != nil {
		log.Println("Advertencia: No se encontró archivo .env, usando variables de entorno directamente")
	}

	fmt.Printf("🔧 DEBUG: Parseando flags...\n")
	// Parsear flags
	var (
		port        = flag.Int("port", getEnvInt("PORT", 8080), "HTTP service port")
		dataDir     = flag.String("data-dir", getEnv("DATA_DIR", "./data"), "Directory for data storage")
		useMock     = flag.Bool("mock-auth", getEnvBool("MOCK_AUTH", true), "Use mock authentication for development")
		usePostgres = flag.Bool("postgres", getEnvBool("USE_POSTGRES", true), "Use PostgreSQL database instead of file storage")
		migrateData = flag.Bool("migrate", getEnvBool("MIGRATE_DATA", true), "Migrate data from JSON files to PostgreSQL")
	)
	flag.Parse()

	fmt.Printf("🔧 DEBUG: Creando directorio de datos...\n")
	// Crear directorio de datos si no existe
	if err := os.MkdirAll(*dataDir, 0755); err != nil {
		log.Fatalf("Error al crear directorio de datos: %v", err)
	}

	fmt.Printf("🔧 DEBUG: Inicializando store de datos...\n")
	// Inicializar el almacén de datos (store)
	var store data.DataStore

	// Decidir si usar PostgreSQL o almacenamiento en archivos basado en la flag
	if *usePostgres {
		log.Println("Usando PostgreSQL como almacén de datos")

		fmt.Printf("🔧 DEBUG: Conectando a PostgreSQL...\n")
		// Inicializar conexión a PostgreSQL
		database, err := db.InitDB()
		if err != nil {
			log.Fatalf("Error al conectar a PostgreSQL: %v", err)
		}
		defer db.Close()

		fmt.Printf("🔧 DEBUG: Inicializando esquema...\n")
		// Inicializar esquema de base de datos
		if err := db.InitializeSchema(database); err != nil {
			log.Fatalf("Error al inicializar esquema de base de datos: %v", err)
		}

		// Migrar datos desde JSON si se solicita
		if *migrateData {
			log.Println("Migrando datos de archivos JSON a PostgreSQL...")
			if err := db.MigrateAllFromJSON(database, *dataDir); err != nil {
				log.Printf("Advertencia: Error durante la migración de datos: %v", err)
			}
		}

		fmt.Printf("🔧 DEBUG: Creando PostgreSQL store...\n")
		// Crear store PostgreSQL
		store = db.NewPostgreSQLStore(database)
		ensureWidgetSystemUser(store)
		ensureAdminUser(store)
	} else {
		log.Println("Usando almacenamiento en archivos")
		store = data.NewStore(*dataDir)
		ensureWidgetSystemUser(store)
		ensureAdminUser(store)
	}

	fmt.Printf("🔧 DEBUG: Creando handlers...\n")
	// Crear handlers
	authHandler := &handlers.AuthHandler{Store: store}
	ticketHandler := &handlers.TicketHandler{Store: store}
	categoryHandler := &handlers.CategoryHandler{Store: store}
	faqHandler := &handlers.FAQHandler{Store: store}

	fmt.Printf("🔧 DEBUG: Creando enrutador...\n")
	// Crear enrutador (usando http.ServeMux básico para simplicidad)
	mux := http.NewServeMux()

	fmt.Printf("🔧 DEBUG: Configurando middleware de autenticación...\n")
	// Middleware de autenticación
	var authMiddleware func(http.Handler) http.Handler

	if *useMock {
		authMiddleware = middleware.MockAuth
		log.Println("Usando autenticación de prueba para desarrollo")
	} else {
		authMiddleware = middleware.Auth
		log.Println("Usando autenticación REAL")
	}

	fmt.Printf("🔧 DEBUG: Registrando rutas de salud...\n")
	// Rutas de comprobación de estado
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		utils.WriteJSON(w, http.StatusOK, map[string]string{
			"status":  "ok",
			"message": "Servidor funcionando",
		})
	})

	fmt.Printf("🔧 DEBUG: Registrando rutas de autenticación...\n")

	// RUTA WEBSOCKET - REGISTRADA PRIMERO PARA MÁXIMA PRIORIDAD
	fmt.Printf("🔧 REGISTRANDO HANDLER WEBSOCKET para /api/ws/chat/ (PRIORIDAD MÁXIMA)\n")
	mux.HandleFunc("/api/ws/chat/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("🔧 WEBSOCKET HANDLER EJECUTÁNDOSE para ruta dinámica: %s\n", r.URL.Path)

		// Usar directamente el WebSocket handler con la interfaz DataStore
		websocket.ChatHandler(store)(w, r)
	})

	// Rutas de autenticación
	mux.HandleFunc("/api/auth/login", authHandler.Login)
	mux.HandleFunc("/api/auth/register", authHandler.Register)
	mux.Handle("/api/auth/me", authMiddleware(http.HandlerFunc(authHandler.Me)))

	// Rutas de tickets (autenticadas)
	mux.Handle("/api/tickets", authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Manejar basado en el método HTTP
		switch r.Method {
		case http.MethodGet:
			ticketHandler.GetAllTickets(w, r)
		case http.MethodPost:
			ticketHandler.CreateTicket(w, r)
		default:
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		}
	})))

	// Rutas de tickets individuales
	mux.Handle("/api/tickets/", authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// DEBUG: Log detallado de todas las peticiones a tickets
		fmt.Printf("🔍 ROUTER TICKETS - URL: %s, Método: %s, Path: %s\n", r.URL.String(), r.Method, r.URL.Path)

		path := r.URL.Path

		// DEBUG: Log información sobre el parsing del path
		dir := filepath.Dir(path)
		base := filepath.Base(path)
		ext := filepath.Ext(path)
		baseDir := filepath.Base(dir)

		fmt.Printf("📂 PATH DEBUG - Dir: %s, Base: %s, Ext: %s, BaseDir: %s\n", dir, base, ext, baseDir)

		// NUEVO: Manejar la ruta de asignación de tickets PRIMERO
		if filepath.Base(path) == "assign" {
			// Esta es una ruta para asignación como /api/tickets/:id/assign
			fmt.Printf("🎯 MATCHING: Ruta de asignación de ticket detectada\n")
			if r.Method == http.MethodPost || r.Method == http.MethodPut {
				fmt.Printf("➡️ CALLING: ticketHandler.AssignTicket\n")
				ticketHandler.AssignTicket(w, r)
			} else {
				fmt.Printf("❌ MÉTODO NO PERMITIDO para asignación: %s\n", r.Method)
				http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
			}
		} else if strings.HasSuffix(path, "/messages") {
			// Esta es una ruta para mensajes de tickets como /api/tickets/:id/messages
			fmt.Printf("🎯 MATCHING: Ruta de mensajes de ticket detectada\n")
			switch r.Method {
			case http.MethodGet:
				fmt.Printf("➡️ CALLING: ticketHandler.GetTicketMessages\n")
				ticketHandler.GetTicketMessages(w, r)
			case http.MethodPost:
				fmt.Printf("🚀 CALLING: ticketHandler.AddTicketMessage DESDE ROUTER\n")
				ticketHandler.AddTicketMessage(w, r)
			default:
				fmt.Printf("❌ MÉTODO NO PERMITIDO para mensajes: %s\n", r.Method)
				http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
			}
		} else if len(strings.Split(path, "/")) == 4 {
			// Esta es una ruta para un ID de ticket específico como /api/tickets/:id
			fmt.Printf("🎯 MATCHING: Ruta de ticket específico detectada\n")
			switch r.Method {
			case http.MethodGet:
				fmt.Printf("➡️ CALLING: ticketHandler.GetTicket\n")
				ticketHandler.GetTicket(w, r)
			case http.MethodPut:
				fmt.Printf("➡️ CALLING: ticketHandler.UpdateTicket\n")
				ticketHandler.UpdateTicket(w, r)
			default:
				fmt.Printf("❌ MÉTODO NO PERMITIDO para ticket específico: %s\n", r.Method)
				http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
			}
		} else {
			fmt.Printf("❌ NO MATCH: Ningún patrón coincide, enviando 404\n")
			http.NotFound(w, r)
		}
	})))

	// Rutas de widget (públicas)
	// Comentado temporalmente porque el método CreateWidgetTicket no existe
	// mux.HandleFunc("/widget/tickets", ticketHandler.CreateWidgetTicket)
	// mux.HandleFunc("/api/widget/tickets", ticketHandler.CreateWidgetTicket) // Ruta alternativa para el widget

	// ÚNICO: Endpoint para que widget-api pueda enviar mensajes al backend
	mux.HandleFunc("/widget/messages", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			fmt.Printf("🚀 WIDGET MESSAGES: Procesando mensaje desde widget-api\n")
			// Convertir esto en una llamada a AddTicketMessage
			ticketHandler.AddTicketMessage(w, r)
		} else {
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		}
	})

	// Ruta para obtener mensajes de un ticket desde el widget
	mux.HandleFunc("/widget/tickets/", func(w http.ResponseWriter, r *http.Request) {
		// DEBUG: Log cuando esta ruta es llamada
		fmt.Printf("🔥 WIDGET TICKETS ROUTE - URL: %s, Método: %s, Path: %s\n", r.URL.String(), r.Method, r.URL.Path)

		path := r.URL.Path
		if strings.Contains(path, "/messages") {
			fmt.Printf("📬 WIDGET MESSAGES - Detectada ruta de mensajes\n")
			// Manejar tanto GET (obtener mensajes) como POST (añadir mensajes)
			switch r.Method {
			case http.MethodGet:
				fmt.Printf("➡️ WIDGET GET: Llamando GetTicketMessages\n")
				ticketHandler.GetTicketMessages(w, r)
			case http.MethodPost:
				fmt.Printf("➡️ WIDGET POST: Llamando AddTicketMessage\n")
				ticketHandler.AddTicketMessage(w, r)
			default:
				fmt.Printf("❌ WIDGET: Método no permitido para esta ruta: %s\n", r.Method)
				http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
			}
		} else {
			fmt.Printf("❌ WIDGET: No es ruta de mensajes, enviando 404\n")
			http.NotFound(w, r)
		}
	})

	// Rutas de categorías (autenticadas)
	mux.Handle("/api/categories", authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Manejar basado en el método HTTP
		switch r.Method {
		case http.MethodGet:
			categoryHandler.GetAllCategories(w, r)
		case http.MethodPost:
			categoryHandler.CreateCategory(w, r)
		default:
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		}
	})))

	// Rutas de categorías individuales
	mux.Handle("/api/categories/", authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Manejar basado en el método HTTP
		switch r.Method {
		case http.MethodGet:
			categoryHandler.GetCategory(w, r)
		case http.MethodPut:
			categoryHandler.UpdateCategory(w, r)
		case http.MethodDelete:
			categoryHandler.DeleteCategory(w, r)
		default:
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		}
	})))

	// Rutas de FAQ (autenticadas para operaciones de administrador)
	mux.Handle("/api/faqs", authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Manejar basado en el método HTTP
		switch r.Method {
		case http.MethodGet:
			faqHandler.GetAllFAQs(w, r)
		case http.MethodPost:
			faqHandler.CreateFAQ(w, r)
		default:
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		}
	})))

	// Rutas de FAQ individuales
	mux.Handle("/api/faqs/", authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		// Comprobar si esta es una ruta para un endpoint de toggle-publish
		if filepath.Base(path) == "toggle-publish" {
			if r.Method == http.MethodPatch {
				faqHandler.TogglePublishFAQ(w, r)
			} else {
				http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
			}
		} else {
			// Esta es una ruta para un ID de FAQ específico
			switch r.Method {
			case http.MethodGet:
				faqHandler.GetFAQ(w, r)
			case http.MethodPut:
				faqHandler.UpdateFAQ(w, r)
			case http.MethodDelete:
				faqHandler.DeleteFAQ(w, r)
			default:
				http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
			}
		}
	})))

	// Rutas de FAQ públicas
	mux.HandleFunc("/widget/faqs", faqHandler.GetPublishedFAQs)
	mux.HandleFunc("/faqs", faqHandler.GetPublishedFAQs) // Endpoint alternativo

	// Rutas de compatibilidad de widget (para manejar las rutas duplicadas /widget/widget/...)
	mux.HandleFunc("/widget/widget/faqs", faqHandler.GetPublishedFAQs)

	// Rutas de usuarios (autenticadas)
	mux.Handle("/api/users", authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Configurar CORS explícitamente
		utils.SetCORS(w)

		// Responder a preflight requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Manejar basado en el método HTTP
		switch r.Method {
		case http.MethodGet:
			// Obtener todos los usuarios
			users, err := store.GetUsers()
			if err != nil {
				http.Error(w, "Error al obtener usuarios", http.StatusInternalServerError)
				return
			}
			utils.WriteJSON(w, http.StatusOK, users)
		case http.MethodPost:
			// Crear un nuevo usuario
			var user struct {
				FirstName  string `json:"firstName"`
				LastName   string `json:"lastName"`
				Email      string `json:"email"`
				Password   string `json:"password"`
				Role       string `json:"role"`
				Department string `json:"department"`
				Active     bool   `json:"active"`
			}

			// Leer el cuerpo de la solicitud
			if err := utils.DecodeJSON(r, &user); err != nil {
				http.Error(w, "Error al leer datos del usuario", http.StatusBadRequest)
				return
			}

			// Generar ID único
			id := fmt.Sprintf("%d", time.Now().UnixNano())

			// Crear nuevo usuario
			newUser := models.User{
				ID:         id,
				FirstName:  user.FirstName,
				LastName:   user.LastName,
				Email:      user.Email,
				Password:   user.Password, // esto debería ser hasheado
				Role:       user.Role,
				Department: user.Department,
				Active:     user.Active,
				CreatedAt:  time.Now(),
				UpdatedAt:  time.Now(),
			}

			// Agregar el usuario al store
			if err := store.CreateUser(newUser); err != nil {
				http.Error(w, "Error al guardar usuario", http.StatusInternalServerError)
				return
			}

			// Devolver el usuario creado
			utils.WriteJSON(w, http.StatusCreated, newUser)
		default:
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		}
	})))

	// Endpoint para sincronización de usuarios
	mux.Handle("/api/users/sync", authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Configurar CORS explícitamente
		utils.SetCORS(w)

		// Responder a preflight requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Solo permitir POST para este endpoint
		if r.Method != http.MethodPost {
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
			return
		}

		// Decodificar los usuarios enviados
		var usersToSync []models.User
		if err := utils.DecodeJSON(r, &usersToSync); err != nil {
			http.Error(w, "Error al decodificar usuarios", http.StatusBadRequest)
			return
		}

		fmt.Printf("📦 Sincronizando %d usuarios...\n", len(usersToSync))

		// Obtener todos los usuarios actuales
		currentUsers, err := store.GetUsers()
		if err != nil {
			http.Error(w, "Error al obtener usuarios actuales", http.StatusInternalServerError)
			return
		}

		// Crear un mapa para facilitar la búsqueda de usuarios por ID
		userMap := make(map[string]models.User)
		for _, user := range currentUsers {
			userMap[user.ID] = user
		}

		// Procesar los usuarios recibidos
		for _, syncUser := range usersToSync {
			// Si no tiene ID, es inválido, saltarlo
			if syncUser.ID == "" {
				continue
			}

			// Si el usuario existe, actualizar si es necesario
			if existingUser, ok := userMap[syncUser.ID]; ok {
				// Ver si hay cambios comparando campos relevantes
				changed := existingUser.FirstName != syncUser.FirstName ||
					existingUser.LastName != syncUser.LastName ||
					existingUser.Email != syncUser.Email ||
					existingUser.Role != syncUser.Role ||
					existingUser.Department != syncUser.Department ||
					existingUser.Active != syncUser.Active

				if changed {
					// Actualizar manteniendo la contraseña actual
					syncUser.Password = existingUser.Password
					syncUser.UpdatedAt = time.Now()

					fmt.Printf("🔄 Actualizando usuario %s (%s %s)\n",
						syncUser.ID, syncUser.FirstName, syncUser.LastName)

					if err := store.UpdateUser(syncUser); err != nil {
						fmt.Printf("❌ Error al actualizar usuario %s: %v\n", syncUser.ID, err)
					}
				}
			} else {
				// Si no existe y tiene datos válidos, crearlo
				if syncUser.Email != "" && syncUser.FirstName != "" && syncUser.LastName != "" {
					// Asegurarse de que tiene una contraseña por defecto segura
					if syncUser.Password == "" {
						syncUser.Password = utils.GenerateRandomPassword(12)
					}

					fmt.Printf("➕ Creando nuevo usuario %s (%s %s)\n",
						syncUser.ID, syncUser.FirstName, syncUser.LastName)

					syncUser.CreatedAt = time.Now()
					syncUser.UpdatedAt = time.Now()

					if err := store.CreateUser(syncUser); err != nil {
						fmt.Printf("❌ Error al crear usuario %s: %v\n", syncUser.ID, err)
					}
				}
			}
		}

		// Devolver todos los usuarios actualizados
		updatedUsers, err := store.GetUsers()
		if err != nil {
			http.Error(w, "Error al obtener usuarios actualizados", http.StatusInternalServerError)
			return
		}

		fmt.Printf("✅ Sincronización completada. %d usuarios en la base de datos.\n", len(updatedUsers))
		utils.WriteJSON(w, http.StatusOK, updatedUsers)
	})))

	// Rutas de usuarios individuales
	mux.Handle("/api/users/", authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Configurar CORS explícitamente
		utils.SetCORS(w)

		// Responder a preflight requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Obtener ID del usuario de la URL
		path := r.URL.Path
		segments := strings.Split(path, "/")
		if len(segments) < 4 {
			http.Error(w, "URL de usuario inválida", http.StatusBadRequest)
			return
		}

		userID := segments[3]

		// Manejar basado en el método HTTP
		switch r.Method {
		case http.MethodGet:
			// Obtener un usuario específico
			user, err := store.GetUser(userID)
			if err != nil {
				http.Error(w, "Usuario no encontrado", http.StatusNotFound)
				return
			}

			utils.WriteJSON(w, http.StatusOK, user)
		case http.MethodPut:
			// Actualizar un usuario
			var updates models.User
			if err := utils.DecodeJSON(r, &updates); err != nil {
				http.Error(w, "Error al leer datos de actualización", http.StatusBadRequest)
				return
			}

			// Obtener usuario existente
			user, err := store.GetUser(userID)
			if err != nil {
				http.Error(w, "Usuario no encontrado", http.StatusNotFound)
				return
			}

			// Actualizar campos
			if updates.FirstName != "" {
				user.FirstName = updates.FirstName
			}
			if updates.LastName != "" {
				user.LastName = updates.LastName
			}
			if updates.Email != "" {
				user.Email = updates.Email
			}
			if updates.Role != "" {
				user.Role = updates.Role
			}
			if updates.Department != "" {
				user.Department = updates.Department
			}
			if updates.Password != "" {
				user.Password = updates.Password // En producción real, esto debería ser hasheado
			}

			// Marcar como actualizado
			user.UpdatedAt = time.Now()

			// Actualizar en el store
			if err := store.UpdateUser(*user); err != nil {
				http.Error(w, "Error al actualizar usuario", http.StatusInternalServerError)
				return
			}

			// Devolver la respuesta actualizada
			utils.WriteJSON(w, http.StatusOK, user)
		case http.MethodDelete:
			// Eliminar un usuario
			if err := store.DeleteUser(userID); err != nil {
				http.Error(w, "Error al eliminar usuario", http.StatusInternalServerError)
				return
			}

			utils.WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
		default:
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		}
	})))

	// Middleware de CORS
	corsMiddleware := func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Establecer encabezados CORS
			utils.SetCORS(w)

			// Manejar preflight requests
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			// Llamar al manejador envolvente
			h.ServeHTTP(w, r)
		})
	}

	// Middleware de logging global para capturar TODAS las peticiones
	loggingMiddleware := func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// DEBUG: Log TODAS las peticiones que llegan al backend
			fmt.Printf("🌐 GLOBAL REQUEST - URL: %s, Método: %s, Path: %s, Headers: %v\n",
				r.URL.String(), r.Method, r.URL.Path, r.Header)

			// Llamar al siguiente handler
			h.ServeHTTP(w, r)
		})
	}

	// Crear servidor con manejador envolvente
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		Handler:      corsMiddleware(loggingMiddleware(mux)),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Iniciar servidor en una goroutine
	go func() {
		log.Printf("Iniciando servidor en el puerto %d", *port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Error al iniciar servidor: %v", err)
		}
	}()

	// Esperar a la señal de interrupción para cerrar el servidor de maneragraceful
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Servidor se está cerrando...")

	// Crear contexto con timeout para cerrar el servidor
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Intentar cerrar el servidor de maneragraceful
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Servidor forzado a cerrarse: %v", err)
	}

	log.Println("Servidor cerrado de maneragraceful")
}

// Helper para obtener variables de entorno con valor por defecto
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// Helper para obtener variables de entorno numéricas con valor por defecto
func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	var result int
	_, err := fmt.Sscanf(value, "%d", &result)
	if err != nil {
		return defaultValue
	}
	return result
}

// Helper para obtener variables de entorno como booleano
func getEnvBool(key string, defaultValue bool) bool {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}

	value, err := strconv.ParseBool(valueStr)
	if err != nil {
		log.Printf("Advertencia: Variable de entorno %s no es un booleano válido, usando valor por defecto: %v", key, defaultValue)
		return defaultValue
	}

	return value
}

// ensureWidgetSystemUser verifica que exista un usuario especial para el widget
// en la base de datos. Si no existe, lo crea para evitar fallos por la
// restricción foreign key cuando se crean tickets desde el widget.
func ensureWidgetSystemUser(store data.DataStore) {
	const widgetUserID = "widget-system"
	if _, err := store.GetUser(widgetUserID); err == nil {
		log.Printf("Usuario widget-system ya existe en la base de datos")
		return
	}

	widgetUser := models.User{
		ID:         widgetUserID,
		FirstName:  "Widget",
		LastName:   "System",
		Email:      "widget@system.com",
		Password:   "widget-password",
		Role:       "admin",
		Department: "Soporte",
		Active:     true,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := store.CreateUser(widgetUser); err != nil {
		log.Printf("Error al crear usuario widget-system: %v", err)
	} else {
		log.Printf("Usuario widget-system creado por defecto")
	}
}

// ensureAdminUser verifica que exista un usuario administrador por defecto
// para facilitar las pruebas y demostraciones del sistema
func ensureAdminUser(store data.DataStore) {
	const adminUserID = "agente-growdesk"
	if _, err := store.GetUser(adminUserID); err == nil {
		log.Printf("Usuario AgenteGrowdesk ya existe en la base de datos")
		return
	}

	adminUser := models.User{
		ID:         adminUserID,
		FirstName:  "Agente",
		LastName:   "GrowDesk",
		Email:      "agente@growdesk.com",
		Password:   "123456",
		Role:       "admin",
		Department: "Soporte",
		Active:     true,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := store.CreateUser(adminUser); err != nil {
		log.Printf("Error al crear usuario AgenteGrowdesk: %v", err)
	} else {
		log.Printf("Usuario administrador AgenteGrowdesk creado por defecto")
	}
}
