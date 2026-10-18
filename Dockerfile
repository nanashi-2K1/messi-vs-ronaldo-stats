FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Le serveur est empaqueté sans dépendance externe : seul dist/ est nécessaire.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 CACHE_DIR=/app/.cache
COPY --from=build /app/dist ./dist
EXPOSE 8787
CMD ["node", "dist/server/index.js"]
