FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY src/ ./src/
RUN mkdir -p data

CMD ["node", "src/bot.js"] 