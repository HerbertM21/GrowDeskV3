#!/bin/bash

# Script de despliegue para GrowDesk
# Este script automatiza el proceso de despliegue en producción

# Colores para la salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
log_message() {
  echo -e "${2}[${1}]${NC} ${3}"
}

log_step() {
  log_message "PASO" "${BLUE}" "$1"
}

log_success() {
  log_message "OK" "${GREEN}" "$1"
}

log_warning() {
  log_message "AVISO" "${YELLOW}" "$1"
}

log_error() {
  log_message "ERROR" "${RED}" "$1"
}

# Mostrar encabezado
clear
echo "================================================="
echo "=          DESPLIEGUE DE GROWDESK               ="
echo "================================================="
echo ""

# Verificar si es un repositorio git
if [ ! -d ".git" ]; then
  log_error "Este script debe ejecutarse desde la raíz del repositorio GrowDesk"
  exit 1
fi

# Determinar el entorno
ENV="development"
if [ "$1" == "prod" ] || [ "$1" == "production" ]; then
  ENV="production"
  COMPOSE_FILE="docker compose.production.yml"
else
  COMPOSE_FILE="docker compose.yml"
fi

log_step "Preparando despliegue en entorno: ${ENV} (usando ${COMPOSE_FILE})"

# Verificar Docker
if ! command -v docker &> /dev/null; then
  log_error "Docker no está instalado. Por favor, instale Docker y vuelva a intentarlo."
  exit 1
fi

if ! command -v docker compose &> /dev/null; then
  log_error "Docker Compose no está instalado. Por favor, instale Docker Compose y vuelva a intentarlo."
  exit 1
fi

# Actualizar el repositorio si es necesario
if [ "$2" != "--no-pull" ]; then
  log_step "Actualizando repositorio..."
  git pull
  if [ $? -ne 0 ]; then
    log_error "No se pudo actualizar el repositorio. Compruebe las credenciales y el acceso."
    exit 1
  fi
  log_success "Repositorio actualizado correctamente."
fi

# Verificar archivos de configuración
if [ "$ENV" == "production" ]; then
  if [ ! -f "backend/.env.production" ]; then
    log_warning "No se encontró el archivo backend/.env.production. Se utilizará un archivo de ejemplo."
    cp backend/.env.example backend/.env.production
  fi
  
  # Verificar estructura de directorios para Nginx
  if [ ! -d "nginx/conf.d" ]; then
    log_step "Creando directorios necesarios para Nginx..."
    mkdir -p nginx/conf.d
    mkdir -p nginx/ssl
    mkdir -p nginx/www
    mkdir -p nginx/logs
    
    # Copiar archivos de configuración si no existen
    if [ ! -f "nginx/conf.d/default.conf" ]; then
      cp nginx/conf.d/default.conf nginx/conf.d/ 2>/dev/null || log_warning "No se pudo copiar la configuración predeterminada de Nginx"
    fi
  fi
else
  if [ ! -f "backend/.env" ]; then
    log_warning "No se encontró el archivo backend/.env. Se utilizará un archivo de ejemplo."
    cp backend/.env.example backend/.env
  fi
fi

# Construir contenedores
log_step "Construyendo contenedores (puede tardar unos minutos)..."
docker compose -f $COMPOSE_FILE build
if [ $? -ne 0 ]; then
  log_error "La construcción de los contenedores falló."
  exit 1
fi
log_success "Contenedores construidos correctamente."

# Iniciar contenedores
log_step "Iniciando servicios..."
docker compose -f $COMPOSE_FILE up -d
if [ $? -ne 0 ]; then
  log_error "No se pudieron iniciar todos los servicios."
  exit 1
fi
log_success "Servicios iniciados correctamente."

# Verificación de salud
log_step "Verificando servicios..."
sleep 5
BACKEND_STATUS=$(docker compose -f $COMPOSE_FILE exec -T backend wget -qO- http://localhost:8080/api/health 2>/dev/null || echo "error")
if [[ $BACKEND_STATUS == *"healthy"* ]]; then
  log_success "Backend está respondiendo correctamente."
else
  log_warning "Backend no respondió correctamente. Verifique los registros."
fi

# Mostrar información final
echo ""
echo "================================================="
if [ "$ENV" == "production" ]; then
  echo "= GrowDesk está desplegado en modo PRODUCCIÓN    ="
  echo "================================================="
  echo "="
  echo "= Configure su servidor web o balanceador para   ="
  echo "= acceder a los servicios en los siguientes      ="
  echo "= puertos:                                       ="
  echo "="
  echo "= - Nginx: 80 (HTTP), 443 (HTTPS)                ="
  echo "=   Redirige a los servicios internos            ="
  echo "="
else
  echo "= GrowDesk está desplegado en modo DESARROLLO    ="
  echo "================================================="
  echo "="
  echo "= Puede acceder a los servicios en:              ="
  echo "="
  echo "= - Frontend: http://localhost:3001              ="
  echo "= - API Backend: http://localhost:8080/api       ="
  echo "= - API Widget: http://localhost:3000            ="
  echo "="
fi
echo "================================================="

exit 0 