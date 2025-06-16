# 🚀 GrowDesk - Guía de Configuración

## Requisitos Previos
- Docker y Docker Compose
- Node.js 18+ (para desarrollo local)
- Git

## 🔧 Configuración Inicial

### 1. Clonar el repositorio
```bash
git clone https://github.com/GrowDesk/GrowDeskV3.git
cd GrowDeskV3
```

### 2. Configurar variables de entorno
```bash
# Copiar archivos de ejemplo
cp .env.example .env
```

### 3. Limpiar dependencias (si hay problemas)
```bash
# En caso de errores de build, limpiar completamente
cd GrowDesk/frontend
rm -rf node_modules package-lock.json
npm install

cd ../..
```

### 4. Construir y ejecutar contenedores
```bash
# Construir desde cero
docker compose down -v
docker compose build --no-cache
docker compose up -d

# Verificar que todos los servicios estén corriendo
docker compose ps
```

## 🐛 Solución de Problemas Comunes

### Error: "Could not load primevue/resources/themes/..."
```bash
cd GrowDesk/frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Error: Categorías duplicadas
```bash
# Limpiar base de datos
docker compose exec postgres psql -U postgres -d growdesk -c "
DELETE FROM categories WHERE name = 'Consultas Generales' AND id != 'e46d054e-8502-40ce-ba29-3cb9f8bbedca';
"
```

### Error: Usuario no encontrado
```bash
# Crear usuario admin
docker compose exec postgres psql -U postgres -d growdesk -c "
INSERT INTO users (id, email, first_name, last_name, role, department, active, password, created_at, updated_at) 
VALUES ('admin-123', 'admin@growdesk.com', 'Admin', 'System', 'admin', 'IT', true, 'admin123', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
"
```

## 🔐 Credenciales por Defecto
- **Email**: admin@growdesk.com
- **Contraseña**: admin123

## 🌐 URLs de Acceso
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8081
- **Widget API**: http://localhost:3002

## 📝 Notas Importantes
- Siempre usar `docker compose build --no-cache` si hay problemas de dependencias
- El tema de PrimeVue se cambió a `aura-light-blue` para mayor compatibilidad
- Las categorías tienen índice único para evitar duplicados 