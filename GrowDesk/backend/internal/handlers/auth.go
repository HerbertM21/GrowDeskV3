package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

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

	fmt.Printf("📝 REGISTER: Iniciando registro de nuevo usuario\n")

	// Parsear el cuerpo de la solicitud
	var registerReq models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&registerReq); err != nil {
		fmt.Printf("❌ REGISTER ERROR: Error al decodificar cuerpo: %v\n", err)
		http.Error(w, "El cuerpo de la solicitud es inválido", http.StatusBadRequest)
		return
	}

	fmt.Printf("📝 REGISTER DATA: Email=%s, FirstName=%s, LastName=%s\n",
		registerReq.Email, registerReq.FirstName, registerReq.LastName)

	// Validar campos requeridos
	if registerReq.Email == "" || registerReq.Password == "" ||
		registerReq.FirstName == "" || registerReq.LastName == "" {
		fmt.Printf("❌ REGISTER ERROR: Campos incompletos\n")
		http.Error(w, "Todos los campos son requeridos", http.StatusBadRequest)
		return
	}

	// Verificar si el usuario ya existe
	_, err := h.Store.GetUserByEmail(registerReq.Email)
	if err == nil {
		fmt.Printf("❌ REGISTER ERROR: El email %s ya está registrado\n", registerReq.Email)
		http.Error(w, "El correo ya está registrado", http.StatusConflict)
		return
	}

	// Generar ID único para el usuario - USAR MISMO FORMATO QUE LA SECCIÓN DE ADMIN
	// Cambio: usar formato numérico para el ID como en la sección de administración
	userID := fmt.Sprintf("%d", time.Now().UnixNano())
	fmt.Printf("📝 REGISTER: ID generado para nuevo usuario: %s\n", userID)

	// Crear objeto de usuario
	newUser := models.User{
		ID:        userID,
		Email:     registerReq.Email,
		FirstName: registerReq.FirstName,
		LastName:  registerReq.LastName,
		Password:  registerReq.Password,
		Role:      "employee", // Por defecto, rol de empleado
		Active:    true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	fmt.Printf("📝 REGISTER: Intentando guardar nuevo usuario en la base de datos...\n")
	// Guardar usuario en la base de datos
	if err := h.Store.CreateUser(newUser); err != nil {
		fmt.Printf("❌ REGISTER ERROR: Error al crear usuario en BD: %v\n", err)
		http.Error(w, "Error al crear usuario: "+err.Error(), http.StatusInternalServerError)
		return
	}
	fmt.Printf("✅ REGISTER SUCCESS: Usuario %s (%s) guardado correctamente\n",
		userID, registerReq.Email)

	// Para diagnóstico: Verificar inmediatamente si el usuario se puede recuperar
	savedUser, err := h.Store.GetUserByEmail(registerReq.Email)
	if err != nil {
		fmt.Printf("⚠️ REGISTER WARNING: El usuario se guardó pero no se puede recuperar: %v\n", err)
	} else {
		fmt.Printf("✅ REGISTER VERIFICATION: Usuario verificado en BD: ID=%s, Email=%s\n",
			savedUser.ID, savedUser.Email)
	}

	// Generar token JWT con la información del usuario
	token, err := utils.GenerateToken(newUser.ID, newUser.Email, newUser.Role)
	if err != nil {
		fmt.Printf("⚠️ REGISTER WARNING: Error al generar token JWT: %v\n", err)
		// Fallback a mock token si hay problemas
		token = utils.GenerateMockToken()
	}

	// Preparar respuesta
	resp := models.AuthResponse{
		Token: token,
		User:  newUser,
	}

	fmt.Printf("✅ REGISTER COMPLETE: Devolviendo respuesta para usuario %s\n", newUser.ID)

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
