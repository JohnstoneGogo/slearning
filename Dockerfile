# S Learning production image. Build: docker build -t s-learning .   Run: see README (needs DATABASE_URL etc.)
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM base AS run
ENV NODE_ENV=production PORT=3000
COPY --from=build /app ./
VOLUME ["/app/uploads"]
EXPOSE 3000
# Apply database migrations, then start the server (the payout worker starts with it).
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p ${PORT}"]
