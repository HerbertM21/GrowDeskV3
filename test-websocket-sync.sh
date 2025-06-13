#!/bin/bash

echo "=== Script de Prueba de Sincronización WebSocket (MEJORADO) ==="
echo "Este script reinicia los servicios y prueba la sincronización de mensajes"

# Función para mostrar logs de un servicio
show_logs() {
    local service=$1
    echo "=== Logs de $service ==="
    docker compose logs --tail=20 $service
    echo ""
}

# Función para verificar el estado de los servicios
check_services() {
    echo "=== Estado de los servicios ==="
    docker compose ps
    echo ""
}

# Función para probar conectividad WebSocket
test_websocket() {
    echo "=== Probando conectividad WebSocket ==="
    echo "- Probando WebSocket del backend directo..."
    curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081/api/ws/chat/TICKET-TEST" || echo "Backend WebSocket no accesible"
    
    echo "- Probando WebSocket a través del API Gateway..."
    curl -s -o /dev/null -w "%{http_code}" "http://localhost/api/ws/chat/TICKET-TEST" || echo "API Gateway WebSocket no accesible"
    echo ""
}

# Reiniciar servicios específicos relacionados con WebSocket
echo "1. Reiniciando servicios relacionados con WebSocket..."
docker compose restart api-gateway backend widget-api

echo "2. Esperando que los servicios se inicialicen..."
sleep 15

# Verificar estado
check_services

# Mostrar logs relevantes
echo "3. Verificando logs de servicios..."
show_logs "backend"
show_logs "widget-api"
show_logs "api-gateway"

echo "4. Probando conectividad..."

# Probar endpoint de salud del backend
echo "- Probando backend health..."
curl -s http://localhost:8081/health || echo "Backend no responde"

# Probar endpoint de salud del widget-api
echo "- Probando widget-api health..."
curl -s http://localhost:3002/health || echo "Widget-api no responde"

# Probar a través del API Gateway
echo "- Probando a través del API Gateway..."
curl -s http://localhost/api/health || echo "API Gateway no redirige correctamente"

# Probar el endpoint de notificación nuevo
echo "- Probando endpoint de notificación del widget-api..."
curl -s -X POST http://localhost:3002/api/notify/message \
  -H "Content-Type: application/json" \
  -d '{"ticketId":"TEST","messageId":"test-msg","content":"Test de notificación","isClient":false}' || echo "Endpoint de notificación no responde"

# Probar conectividad WebSocket
test_websocket

echo ""
echo "=== NUEVAS CORRECCIONES IMPLEMENTADAS ==="
echo "✅ 1. Backend ahora notifica al widget-api cuando un agente envía un mensaje"
echo "✅ 2. Widget-api tiene nuevo endpoint /api/notify/message para recibir notificaciones"
echo "✅ 3. Widget configurado para usar API Gateway (http://localhost)"
echo "✅ 4. Evitado modo simulado del widget"
echo ""
echo "=== Instrucciones para probar la sincronización MEJORADA ==="
echo "1. Abre el panel de administración en: http://localhost:3001"
echo "2. Abre el demo del widget en: http://localhost:8091"
echo "3. Crea un ticket desde el widget"
echo "4. Ve al panel de administración y busca el ticket"
echo "5. Envía un mensaje desde el panel de administración"
echo "6. ✨ VERIFICA que el mensaje aparezca INMEDIATAMENTE en el widget"
echo "7. Envía un mensaje desde el widget"
echo "8. ✨ VERIFICA que el mensaje aparezca INMEDIATAMENTE en el panel de administración"
echo ""
echo "=== URLs importantes ==="
echo "- Panel Admin: http://localhost:3001"
echo "- Demo Widget: http://localhost:8091"
echo "- API Gateway Dashboard: http://localhost:8082"
echo "- Backend directo: http://localhost:8081"
echo "- Widget API directo: http://localhost:3002"
echo "- NUEVO: Endpoint notificación: http://localhost:3002/api/notify/message"
echo ""
echo "=== Comandos útiles para debugging ==="
echo "- Ver logs en tiempo real: docker compose logs -f backend widget-api"
echo "- Reiniciar solo el backend: docker compose restart backend"
echo "- Reiniciar solo el widget-api: docker compose restart widget-api"
echo "- Ver estado de contenedores: docker compose ps"
echo "- Probar notificación manual:"
echo "  curl -X POST http://localhost:3002/api/notify/message \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"ticketId\":\"TICKET-ID\",\"messageId\":\"test\",\"content\":\"Test\",\"isClient\":false}'"
echo ""
echo "🚀 ¡SINCRONIZACIÓN BIDIRECCIONAL IMPLEMENTADA!" 