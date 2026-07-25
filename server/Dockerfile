# --- build stage -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- runtime stage -----------------------------------------------------------
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
# --omit=dev is the supported spelling; --production is deprecated on npm 10+.
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Don't run as root.
USER node

# Railway injects PORT; this is documentation plus a sane local default.
EXPOSE 3000

CMD ["npm", "start"]
