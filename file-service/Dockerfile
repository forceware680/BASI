# Dockerfile untuk SIMBASI File API Microservice
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl untuk Docker Healthcheck
RUN apk add --no-cache curl

# Copy dependency definition
COPY package.json ./

# Install dependencies (production)
RUN npm install --omit=dev --no-audit --no-fund

# Copy source code
COPY src ./src

# Buat folder uploads default di dalam container
RUN mkdir -p /app/uploads

# Set environment defaults
ENV PORT=3000
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads

# Expose port
EXPOSE 3000

# Healthcheck definition
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
