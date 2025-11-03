FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
ENV SERVICE_NAME=evaluation-plane
CMD ["node", "src/evaluation-plane.js"]
