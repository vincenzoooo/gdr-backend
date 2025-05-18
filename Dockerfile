# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm install --only=production
COPY . .
# Aggiungi qui i comandi per buildare la tua applicazione Angular se necessario
# Esempio (ipotizzando una cartella 'dist' con la build di Angular):
# RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json .
COPY --from=builder /app/server.js .
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/models ./models
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/.env .
# Se hai una build di frontend statica, copiala qui
# COPY --from=builder /app/dist ./public

EXPOSE 3000
CMD [ "node", "server.js" ]