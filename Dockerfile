FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./

RUN npm install --omit=dev --no-audit --no-fund

COPY . .

RUN mkdir -p /app/storage/uploads

EXPOSE 8080

CMD ["npm", "start"]
