FROM node:22-slim

WORKDIR /app
COPY . .

RUN npm install --no-audit --no-fund && npm run build

EXPOSE 5173 3001

ENV NODE_ENV=production
ENV VITE_API_URL=http://localhost:3001

CMD ["npm", "start"]
