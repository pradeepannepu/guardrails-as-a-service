FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
ENV SERVICE_NAME=policy-svc
CMD ["node", "src/policy-service.js"]
