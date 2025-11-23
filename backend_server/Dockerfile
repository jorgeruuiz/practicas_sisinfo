# --- FASE DE BUILD (Instalación de dependencias) ---
FROM node:20-alpine AS builder

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copiamos el package.json desde su ubicación real (backend_server/) 
# dentro del contexto (que es la raíz del proyecto).
COPY backend_server/package*.json ./
RUN npm install

# Copia todo el código fuente del backend (solo el contenido de backend_server)
# para que los archivos queden directamente en /usr/src/app
COPY backend_server/ .

# Copia los archivos estáticos del frontend.
COPY frontend_web/dist /usr/src/app/public 

# --- FASE DE PRODUCCIÓN (Imagen final) ---
FROM node:20-alpine

# Establece el directorio de trabajo
WORKDIR /usr/src/app

# Copia los archivos necesarios desde la fase de build
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app .

# Puerto expuesto por el servidor Node.js 
EXPOSE 8080 

# Comando para iniciar el servidor
CMD ["npm", "start"]

LABEL maintainer="[Cuestionados]"