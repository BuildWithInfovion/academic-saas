FROM node:20-slim

# Required for Prisma on Debian slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

# Copy and permission the startup script; strip Windows CRLF if present
COPY start.sh ./start.sh
RUN sed -i 's/\r//' ./start.sh && chmod +x ./start.sh

EXPOSE 3000

CMD ["./start.sh"]
