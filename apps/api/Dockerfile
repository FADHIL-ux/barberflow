# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (argon2)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm install
RUN npm run build -w @barberflow/api

# Stage 2: Runtime
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install runtime dependencies for native modules
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm install --omit=dev --workspace=@barberflow/api

COPY --from=builder /app/apps/api/dist ./apps/api/dist

USER node

EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
