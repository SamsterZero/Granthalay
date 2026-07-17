FROM oven/bun:1.3.14-debian AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build
RUN echo "===== BUILD OUTPUT =====" && \
    find /app/build -maxdepth 1 -type f | sort && \
    echo "===== SVELTE OUTPUT =====" && \
    find /app/.svelte-kit/output -type f | sort || true
# Runtime stage
FROM nginx:alpine

# Remove the default website
RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/build/. /usr/share/nginx/html/

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]