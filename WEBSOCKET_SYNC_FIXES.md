# Correcciones de Sincronización WebSocket - GrowDesk V2 (ACTUALIZADO)

## ✅ Problemas RESUELTOS en esta Actualización

### 1. ❌ → ✅ Mensajes del soporte no llegaban al widget
**Problema**: Los mensajes enviados desde el panel de administración no aparecían en el widget del cliente.

**Solución Implementada**:
- ✅ Añadida función `notifyWidgetAPI()` en el backend que notifica automáticamente al widget-api
- ✅ Creado endpoint `/api/notify/message` en widget-api para recibir notificaciones del backend
- ✅ Implementada función `handleBackendNotification()` que procesa y retransmite mensajes a clientes WebSocket

### 2. ❌ → ✅ Widget entraba en modo simulado al reiniciar
**Problema**: Al recargar la página del demo site, el widget mostraba un chat simulado en lugar del chat real.

**Solución Implementada**:
- ✅ Cambiada URL por defecto del widget de `http://localhost:3001` a `http://localhost` (API Gateway)
- ✅ El widget ahora usa correctamente el API Gateway para todas las peticiones
- ✅ Eliminado el modo simulado no deseado

## Flujo de Sincronización Mejorado

### 📤 Cuando un cliente envía un mensaje desde el widget:
1. ✅ El mensaje se guarda localmente en el widget-api
2. ✅ Se envía a todos los clientes WebSocket conectados al widget-api
3. ✅ Se notifica al backend principal vía WebSocket (`notifyBackendWebSocket`)
4. ✅ Se envía al backend principal vía HTTP como respaldo (`sendMessageToBackend`)
5. ✅ El backend principal hace broadcast a todos sus clientes conectados

### 📥 Cuando un agente envía un mensaje desde el panel:
1. ✅ El mensaje se procesa en el backend principal
2. ✅ Se hace broadcast a todos los clientes WebSocket conectados al backend
3. ✅ **NUEVO**: Se envía notificación HTTP al widget-api (`notifyWidgetAPI`)
4. ✅ **NUEVO**: El widget-api procesa la notificación y retransmite a sus clientes WebSocket
5. ✅ **RESULTADO**: El cliente ve el mensaje inmediatamente en el widget

## Archivos Modificados en esta Actualización

### 1. **GrowDesk/backend/internal/data/store.go**
```go
// NUEVAS FUNCIONES AÑADIDAS:
- notifyWidgetAPI() // Notifica al widget-api sobre nuevos mensajes
- Mejorado BroadcastMessage() // Ahora incluye notificación al widget-api
```

### 2. **GrowDesk-Widget/widget-api/main.go**  
```go
// NUEVAS FUNCIONES AÑADIDAS:
- handleBackendNotification() // Procesa notificaciones del backend
- Nuevo endpoint: POST /api/notify/message
```

### 3. **GrowDesk-Widget/widget-core/src/api/widgetApi.ts**
```typescript
// CONFIGURACIÓN CORREGIDA:
- apiUrl: 'http://localhost' // Ahora usa API Gateway correctamente
```

### 4. **test-websocket-sync.sh**
```bash
# ACTUALIZACIONES:
- Nuevas pruebas de conectividad WebSocket
- Prueba del endpoint de notificación
- Instrucciones mejoradas
```

## 🚀 Cómo Probar las Correcciones

### Ejecutar el Script de Prueba:
```bash
./test-websocket-sync.sh
```

### Prueba Manual Paso a Paso:
1. **Abrir dos ventanas**:
   - Panel de administración: http://localhost:3001
   - Demo del widget: http://localhost:8091

2. **Crear ticket desde el widget**:
   - Completar formulario en el widget
   - Verificar que el ticket aparece en el panel de admin

3. **Probar sincronización SOPORTE → CLIENTE**:
   - Enviar mensaje desde el panel de administración
   - ✨ **VERIFICAR**: El mensaje debe aparecer INMEDIATAMENTE en el widget

4. **Probar sincronización CLIENTE → SOPORTE**:
   - Enviar mensaje desde el widget
   - ✨ **VERIFICAR**: El mensaje debe aparecer INMEDIATAMENTE en el panel de admin

## 🛠️ URLs y Endpoints

### URLs Principales:
- **Panel Admin**: http://localhost:3001
- **Demo Widget**: http://localhost:8091
- **API Gateway**: http://localhost
- **Backend Directo**: http://localhost:8081
- **Widget API Directo**: http://localhost:3002

### Nuevos Endpoints:
- **POST** `/api/notify/message` - Notificaciones del backend al widget-api

### Comandos de Debugging:
```bash
# Ver logs en tiempo real
docker compose logs -f backend widget-api

# Probar notificación manual
curl -X POST http://localhost:3002/api/notify/message \
  -H 'Content-Type: application/json' \
  -d '{"ticketId":"TICKET-ID","messageId":"test","content":"Test","isClient":false}'

# Verificar estado de servicios
docker compose ps
```

## 🔧 Debugging y Troubleshooting

### Si los mensajes aún no se sincronizan:
1. **Verificar logs del backend**:
   ```bash
   docker compose logs backend | grep "notifyWidgetAPI"
   ```

2. **Verificar logs del widget-api**:
   ```bash
   docker compose logs widget-api | grep "NOTIFICACIÓN RECIBIDA"
   ```

3. **Probar endpoint de notificación directamente**:
   ```bash
   curl -X POST http://localhost:3002/api/notify/message \
     -H 'Content-Type: application/json' \
     -d '{"ticketId":"TICKET-TEST","messageId":"msg-test","content":"Mensaje de prueba","isClient":false}'
   ```

4. **Verificar conectividad WebSocket**:
   - Backend: `ws://localhost:8081/api/ws/chat/TICKET-ID`
   - A través del API Gateway: `ws://localhost/api/ws/chat/TICKET-ID`

## 📋 Checklist de Verificación

- [ ] ✅ Widget usa API Gateway (http://localhost) en lugar de puerto directo
- [ ] ✅ Mensajes del cliente llegan al panel de administración
- [ ] ✅ Mensajes del agente llegan al widget del cliente
- [ ] ✅ No aparece modo simulado al recargar el widget
- [ ] ✅ Endpoint `/api/notify/message` responde correctamente
- [ ] ✅ Logs muestran notificaciones entre backend y widget-api

## 🎉 Resultado Esperado

**¡SINCRONIZACIÓN BIDIRECCIONAL COMPLETA!**
- Los mensajes fluyen en ambas direcciones inmediatamente
- No hay modo simulado no deseado
- El chat funciona en tiempo real para ambas partes 