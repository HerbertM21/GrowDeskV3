#!/bin/sh

# Script para sustituir variables de entorno en tiempo de ejecución
# para aplicaciones SPA desplegadas con Nginx

echo "🚀 Iniciando GrowDesk Frontend..."
echo "📊 Variables de entorno disponibles:"
echo "   - VITE_API_URL: $VITE_API_URL"
echo "   - VITE_SYNC_API_URL: $VITE_SYNC_API_URL"
echo "   - NODE_ENV: $NODE_ENV"

# Directorio donde se encuentran los archivos estáticos
STATIC_DIR=/usr/share/nginx/html

# Verificar que el directorio existe y tiene contenido
echo "📁 Verificando directorio $STATIC_DIR..."
if [ -d "$STATIC_DIR" ]; then
    echo "   ✅ Directorio existe"
    ls -la $STATIC_DIR
else
    echo "   ❌ ERROR: Directorio no existe"
    exit 1
fi

# Sustituir variables de entorno en los archivos main.js
echo "📝 Configurando variables de entorno..."

# Listar todos los archivos JavaScript en el directorio
JS_FILES=$(find $STATIC_DIR -name "*.js" -type f)
JS_COUNT=$(echo "$JS_FILES" | wc -l)
echo "🔍 Encontrados $JS_COUNT archivos JavaScript"

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
            # Cuenta las ocurrencias para verificar
            COUNT=$(grep -c "$value" $file || echo 0)
            echo "   - $COUNT ocurrencias encontradas después del reemplazo"
        else
            echo "   - Variable $var no tiene valor, se omite"
        fi
    done
done

# Verificar si hay archivos localStorage-fix.json
if [ -f "$STATIC_DIR/localStorage-fix.json" ]; then
    echo "✅ localStorage-fix.json encontrado"
    cat $STATIC_DIR/localStorage-fix.json
else
    echo "⚠️ localStorage-fix.json no encontrado, creando uno básico"
    echo '{"id":"growdesk-fix","version":1}' > $STATIC_DIR/localStorage-fix.json
fi

echo "✅ Configuración completa"
echo "🌐 Iniciando servidor web en puerto 3000..."

# Ejecutar comando original
exec "$@" 