#!/bin/bash

# Nombre del contenedor y la red
CONTAINER_NAME="sisinf-node"
IMAGE_NAME="sisinf/node:latest"
NETWORK_NAME="sisinf-network"
DOCKERFILE_PATH="./backend_server/Dockerfile" # Ruta al Dockerfile

echo "--- Iniciando Despliegue de Sistema de Información ---"

# 1. Verificar y crear la red de Docker (si no existe)
docker network inspect $NETWORK_NAME >/dev/null 2>&1 || \
    docker network create --driver bridge $NETWORK_NAME
echo "Red Docker '$NETWORK_NAME' verificada/creada."

# 2. Limpieza de contenedores previos
if [ "$(docker ps -a -q -f name=$CONTAINER_NAME)" ]; then
    echo "Preparando limpieza de contenedores previos..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

# 3. Construir la imagen del backend
# El contexto de la construcción (el punto '.') es la carpeta raíz del proyecto, 
# lo que permite acceder a 'frontend_web/dist'.
echo "Construyendo imagen $IMAGE_NAME desde backend_server..."
docker build -t $IMAGE_NAME -f $DOCKERFILE_PATH .

# 4. Iniciar el contenedor de la aplicación
echo "Iniciando contenedor sisinf-node con variables de entorno..."

# Usamos --env-file para cargar todas las variables del .env directamente en Docker
docker run -d \
    --name sisinf-node \
    --network sisinf-network \
    -p 8080:8080 \
    --restart always \
    --env-file .env \
    sisinf/node:latest
echo "Esperando 5 segundos para el arranque..."
sleep 5

# 5. Verificación de estado
echo "--- Verificación de estado del contenedor: ---"
docker ps -f name=$CONTAINER_NAME

echo "Despliegue completo. Accede a tu aplicación en http://localhost:8080"