#!/bin/sh

# Script para sustituir variables de entorno en tiempo de ejecución
# para aplicaciones SPA desplegadas con Nginx

echo "🚀 Iniciando GrowDesk Frontend..."

# Directorio donde se encuentran los archivos estáticos
STATIC_DIR=/usr/share/nginx/html

# Sustituir variables de entorno en los archivos main.js
echo "📝 Configurando variables de entorno..."

# Listar todos los archivos JavaScript en el directorio
JS_FILES=$(find $STATIC_DIR -name "*.js" -type f)

# Sustituir variables de entorno en cada archivo JS
for file in $JS_FILES; do
    echo "🔧 Procesando archivo: $file"
    
    # Lista de variables de entorno a reemplazar
    for var in VITE_API_URL VITE_SYNC_API_URL; do
        value=$(eval echo \$$var)
        if [ -n "$value" ]; then
            echo "   - Reemplazando $var con $value"
            # Reemplaza las ocurrencias en el formato import.meta.env.VITE_XXX
            sed -i "s|import.meta.env.$var|\"$value\"|g" $file
            # Reemplaza las ocurrencias en el formato "VITE_XXX"
            sed -i "s|\"$var\"|\"$value\"|g" $file
        fi
    done
done

echo "✅ Configuración completa"
echo "🌐 Iniciando servidor web..."

# Ejecutar comando original
exec "$@" 