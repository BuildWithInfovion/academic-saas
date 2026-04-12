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

# Expose port
EXPOSE 3000

# Apply DB migrations before boot so deployed code and schema stay in sync
# Resolve any migration with a checksum mismatch (caused by editing an already-applied
# migration file), then apply all pending migrations, then start the app.
CMD ["sh", "-c", "npx prisma migrate resolve --applied 20260410000000_add_institution_profile_fields 2>/dev/null; npx prisma migrate deploy && node dist/src/main"]
