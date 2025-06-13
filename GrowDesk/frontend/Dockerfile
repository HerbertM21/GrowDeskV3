# This is a placeholder file
# Use Dockerfile.dev for development environment
# Use Dockerfile.prod for production environment

# Etapa de construcción
FROM node:18-alpine AS build

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias
RUN apk add --no-cache bash curl

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias exactas
RUN npm ci || npm install

# Copiar el código fuente
COPY . .

# Argumentos de construcción que pueden ser sobrescritos
ARG VITE_API_URL=http://localhost/api
ARG VITE_SYNC_API_URL=http://localhost/api/sync/users
ARG NODE_ENV=production

# Variables de entorno para la construcción
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SYNC_API_URL=$VITE_SYNC_API_URL
ENV NODE_ENV=$NODE_ENV

# Construir la aplicación
RUN npm run build

# Etapa de producción con Nginx
FROM nginx:alpine

# Copiar la configuración de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos de construcción
COPY --from=build /app/dist /usr/share/nginx/html

# Script para sustituir variables de entorno en tiempo de ejecución
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

# Exponer puerto
EXPOSE 80

# Comando para iniciar Nginx con posibilidad de sustituir variables de entorno
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"] 