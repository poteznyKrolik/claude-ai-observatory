FROM node:22-slim

WORKDIR /app
COPY . .

RUN npm install --no-audit --no-fund && npm run build

EXPOSE 4747

ENTRYPOINT ["npm", "exec", "--", "codeburn", "web", "--port", "4747", "--host", "0.0.0.0"]
