#!/bin/bash

echo "🔄 Iniciando Stack Completo: GrowDesk V2 + Vidriera Web + Widget"
echo "================================================================"

# Detener procesos locales si están corriendo
echo "⏹️  Deteniendo servicios existentes..."
pkill -f "astro dev" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true

# Detener contenedores existentes (desde la raíz del proyecto)
echo "🛑 Deteniendo contenedores existentes..."
docker compose down 2>/dev/null || true

# Construir y levantar todo el stack completo (incluyendo la Vidriera Web)
echo "🚀 Construyendo e iniciando el stack completo..."
docker compose build
docker compose up -d

# Mostrar estado de los servicios
echo ""
echo "📊 Estado de los servicios:"
docker compose ps

echo ""
echo "🌐 URLs de acceso:"
echo "   • API Gateway (Traefik): http://localhost"
echo "   • GrowDesk Frontend: http://localhost:3001"
echo "   • GrowDesk Backend: http://localhost:8081"
echo "   • Vidriera Web (Cristales del Valle): http://localhost:4321"
echo "   • Widget API: http://localhost:3002"
echo "   • Widget Core: http://localhost:3031"
echo "   • Widget Demo: http://localhost:8091"
echo "   • Sync Server: http://localhost:8001"
echo ""
echo "✅ Stack completo iniciado correctamente!"
echo "   • El widget debería funcionar en la Vidriera Web"
echo "   • Todos los servicios están integrados y comunicándose"
echo ""
echo "📝 Para ver los logs:"
echo "   docker compose logs -f vidriera-web"
echo "   docker compose logs -f widget-api"
echo ""
echo "🛑 Para detener todo:"
echo "   docker compose down" 