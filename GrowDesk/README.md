# GrowDesk

Sistema de gestión de tickets de soporte para empresas.

## Estructura del proyecto

- **frontend**: Aplicación Vue.js con el panel de administración
- **backend**: API REST en Go
- **nginx**: Configuración del servidor web
- **docker-compose.yml**: Configuración para desarrollo
- **docker-compose.production.yml**: Configuración para producción

## Requisitos

- Docker y Docker Compose
- Node.js 18+ (para desarrollo local)
- Go 1.21+ (para desarrollo local)

## Configuración de desarrollo

1. Clona el repositorio:
```bash
git clone https://github.com/yourusername/GrowDesk.git
cd GrowDesk
```

2. Crea los archivos de entorno:
```bash
cp backend/.env.example backend/.env
```

3. Inicia el entorno de desarrollo:
```bash
docker-compose up
```

4. Accede a la aplicación:
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:8080/api

## Configuración para producción

1. Crea los archivos de entorno para producción:
```bash
cp backend/.env.example backend/.env.production
# Edita las variables según tu entorno
```

2. Crea la estructura de directorios para Nginx:
```bash
mkdir -p nginx/conf.d
mkdir -p nginx/ssl
mkdir -p nginx/www
mkdir -p nginx/logs
```

3. Despliega con Docker Compose en producción:
```bash
docker-compose -f docker-compose.production.yml up -d
```

4. Para actualizar la aplicación:
```bash
git pull
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d
```

## Widget de chat

GrowDesk incluye un widget de chat que se puede integrar en cualquier sitio web. Para más detalles, consulta la documentación en la carpeta `GrowDesk-Widget`.

## Dependencias principales

- Vue.js 3 con Typescript
- Pinia para gestión de estado
- PrimeVue 4.3.5 para componentes UI
- Go con Gin para la API
- PostgreSQL para persistencia
- Redis para caché y WebSockets

## Licencia

Copyright (c) 2024 - Todos los derechos reservados 