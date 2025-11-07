FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
ENV SERVICE_NAME=audit-logger
CMD ["node", "src/audit-logger.js"]
