# 🚀 Guía Completa para Probar la Sincronización WebSocket

## ✅ Estado Actual del Sistema

**TODAS LAS CORRECCIONES HAN SIDO IMPLEMENTADAS:**

1. ✅ **Backend notifica al widget-api** cuando un agente envía un mensaje
2. ✅ **Widget-api tiene endpoint `/api/notify/message`** funcionando 
3. ✅ **Widget configurado para usar API Gateway** (http://localhost)
4. ✅ **Rutas de compatibilidad** agregadas para URLs duplicadas
5. ✅ **Endpoint POST `/widget/tickets/{id}/messages`** agregado al backend

## 🧪 Pasos para Probar la Sincronización

### Paso 1: Verificar que todos los servicios estén funcionando
```bash
docker compose ps
```

### Paso 2: Abrir las interfaces
- **Panel de Administración**: http://localhost:3001
- **Demo del Widget**: http://localhost:8091

### Paso 3: Crear un ticket desde el widget
1. Ve a http://localhost:8091
2. Haz clic en el widget de chat
3. Completa el formulario:
   - Nombre: "Cliente Prueba"
   - Email: "cliente@test.com"  
   - Mensaje: "Este es un mensaje de prueba desde el widget"
4. Envía el ticket
5. **Anota el ID del ticket** que aparece

### Paso 4: Verificar el ticket en el panel de administración
1. Ve a http://localhost:3001
2. Inicia sesión con:
   - Email: admin@example.com
   - Password: password
3. Ve a la sección "Tickets"
4. **Verifica que aparece el ticket** creado desde el widget
5. Haz clic en el ticket para abrirlo

### Paso 5: Probar sincronización SOPORTE → CLIENTE
1. **En el panel de administración**, dentro del ticket:
   - Escribe un mensaje: "Hola, este es un mensaje del agente"
   - Presiona Enviar
2. **En el widget del demo site**:
   - ✨ **VERIFICA**: El mensaje del agente debe aparecer INMEDIATAMENTE
   - Debe aparecer con el avatar del agente (no del cliente)

### Paso 6: Probar sincronización CLIENTE → SOPORTE  
1. **En el widget del demo site**:
   - Escribe un mensaje: "Respuesta del cliente"
   - Presiona Enviar
2. **En el panel de administración**:
   - ✨ **VERIFICA**: El mensaje del cliente debe aparecer INMEDIATAMENTE
   - Debe aparecer con el avatar del cliente

## 🔧 Si algo no funciona...

### Verificar logs en tiempo real:
```bash
docker compose logs -f backend widget-api
```

### Probar el endpoint de notificación manualmente:
```bash
curl -X POST http://localhost:3002/api/notify/message \
  -H 'Content-Type: application/json' \
  -d '{
    "ticketId":"TICKET-ID-AQUI",
    "messageId":"test-msg-manual",
    "content":"Mensaje de prueba manual",
    "isClient":false,
    "userName":"Agente Manual",
    "userEmail":"agente@test.com",
    "timestamp":"2025-06-07T19:00:00Z",
    "source":"backend"
  }'
```

### Verificar conectividad individual:
```bash
# Backend
curl http://localhost:8081/health

# Widget-api  
curl http://localhost:3002/health

# A través del API Gateway
curl http://localhost/api/health
```

## 🎯 Qué debería pasar (Comportamiento esperado)

### ✅ Funcionamiento Correcto:
1. **Mensajes bidireccionales** en tiempo real
2. **Sin modo simulado** en el widget
3. **Mensajes aparecen inmediatamente** en ambas interfaces
4. **Avatares correctos** (cliente vs agente)

### ❌ Si hay problemas:
1. **Mensajes no aparecen**: Revisar logs del backend y widget-api
2. **Modo simulado activo**: Verificar configuración del widget-core
3. **Error 404/405**: Verificar rutas del backend

## 🛠️ URLs de Debugging

- **Panel Admin**: http://localhost:3001
- **Demo Widget**: http://localhost:8091  
- **API Gateway Dashboard**: http://localhost:8082
- **Backend directo**: http://localhost:8081
- **Widget API directo**: http://localhost:3002
- **Endpoint notificación**: http://localhost:3002/api/notify/message

## 🔍 Comandos útiles para debugging

```bash
# Ver logs específicos
docker compose logs backend | grep "BroadcastMessage"
docker compose logs widget-api | grep "NOTIFICACIÓN RECIBIDA"

# Reiniciar servicios específicos
docker compose restart backend widget-api

# Ver estado detallado
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# Probar WebSocket manualmente
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost/api/ws/chat/TICKET-ID
```

## 🎉 Confirmación de Éxito

**La sincronización está funcionando correctamente cuando:**

✅ Los mensajes fluyen en **ambas direcciones**  
✅ Los mensajes aparecen **inmediatamente**  
✅ No hay **modo simulado** en el widget  
✅ Los **avatares son correctos** (cliente vs agente)  
✅ No hay **errores en los logs**  

---

**Si sigues estos pasos y todo funciona, ¡la sincronización WebSocket está completamente operativa!** 🎊 