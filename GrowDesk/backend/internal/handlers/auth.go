package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/data"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/middleware"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/models"
	"github.com/hmdev/GrowDeskV2/GrowDesk/backend/internal/utils"
)

// AuthHandler contiene manejadores para autenticación
type AuthHandler struct {
	Store data.DataStore
}

// Login maneja solicitudes de inicio de sesión de usuarios
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	// Solo maneja solicitudes POST
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Parsear el cuerpo de la solicitud
	var loginReq models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&loginReq); err != nil {
		http.Error(w, "El cuerpo de la solicitud es inválido", http.StatusBadRequest)
		return
	}

	// Validar campos requeridos
	if loginReq.Email == "" || loginReq.Password == "" {
		http.Error(w, "Email y contraseña son requeridos", http.StatusBadRequest)
		return
	}

	// DEBUG: Log del intento de login
	fmt.Printf("🔐 LOGIN ATTEMPT: Email=%s, Password=%s\n", loginReq.Email, loginReq.Password)

	// Buscar usuario en la base de datos por email
	fmt.Printf("🔍 SEARCHING USER: Buscando usuario con email %s...\n", loginReq.Email)
	user, err := h.Store.GetUserByEmail(loginReq.Email)
	if err != nil {
		fmt.Printf("❌ USER NOT FOUND: Error al buscar usuario: %v\n", err)
		http.Error(w, "Credenciales inválidas", http.StatusUnauthorized)
		return
	}

	fmt.Printf("✅ USER FOUND: ID=%s, Email=%s, Password=%s, Active=%t\n",
		user.ID, user.Email, user.Password, user.Active)

	// Verificar la contraseña (en un sistema real usaríamos hash, pero para desarrollo comparamos directamente)
	fmt.Printf("🔑 PASSWORD CHECK: Esperado='%s', Recibido='%s', Match=%t\n",
		user.Password, loginReq.Password, user.Password == loginReq.Password)

	if user.Password != loginReq.Password {
		fmt.Printf("❌ PASSWORD MISMATCH: Contraseña incorrecta\n")
		http.Error(w, "Credenciales inválidas", http.StatusUnauthorized)
		return
	}

	// Verificar que el usuario esté activo
	if !user.Active {
		fmt.Printf("❌ USER INACTIVE: Usuario no está activo\n")
		http.Error(w, "Usuario desactivado", http.StatusUnauthorized)
		return
	}

	fmt.Printf("🎯 LOGIN SUCCESS: Generando token para usuario %s\n", user.ID)

	// Generar token real con la información del usuario
	token, err := utils.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		fmt.Printf("⚠️ TOKEN GENERATION FAILED: %v, usando mock token\n", err)
		// Fallback a mock token si hay problemas
		token = utils.GenerateMockToken()
	}

	// Preparar respuesta con datos reales del usuario
	resp := models.AuthResponse{
		Token: token,
		User: models.User{
			ID:         user.ID,
			Email:      user.Email,
			FirstName:  user.FirstName,
			LastName:   user.LastName,
			Role:       user.Role,
			Department: user.Department,
			Active:     user.Active,
		},
	}

	fmt.Printf("✅ LOGIN COMPLETE: Devolviendo respuesta para usuario %s\n", user.ID)

	// Devolver token y información de usuario real
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// Register maneja el registro de usuarios
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	// Solo maneja solicitudes POST
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Parsear el cuerpo de la solicitud
	var registerReq models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&registerReq); err != nil {
		http.Error(w, "El cuerpo de la solicitud es inválido", http.StatusBadRequest)
		return
	}

	// Validar campos requeridos
	if registerReq.Email == "" || registerReq.Password == "" ||
		registerReq.FirstName == "" || registerReq.LastName == "" {
		http.Error(w, "Todos los campos son requeridos", http.StatusBadRequest)
		return
	}

	// En una implementación real, almacenaríamos al usuario en la base de datos
	// Por ahora, devolveremos una respuesta de éxito con un token fijo

	// Generar token
	token := utils.GenerateMockToken()

	// Preparar respuesta
	resp := models.AuthResponse{
		Token: token,
		User: models.User{
			ID:        "user-" + utils.GenerateTimestamp(),
			Email:     registerReq.Email,
			FirstName: registerReq.FirstName,
			LastName:  registerReq.LastName,
			Role:      "customer",
		},
	}

	// Devolver token y información de usuario
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

// Me devuelve la información del usuario actual
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	// Solo maneja solicitudes GET
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Obtener información del usuario desde el contexto
	// Esto será establecido por el middleware de autenticación
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	email, _ := r.Context().Value(middleware.EmailKey).(string)
	role, _ := r.Context().Value(middleware.RoleKey).(string)

	// Preparar respuesta
	user := models.User{
		ID:        userID,
		Email:     email,
		FirstName: "Admin",
		LastName:  "User",
		Role:      role,
	}

	// Devolver información de usuario
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}
