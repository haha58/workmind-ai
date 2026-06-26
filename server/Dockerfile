# server/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY src/ ./src/

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3001/health/live || exit 1

CMD ["node", "src/index.js"]
