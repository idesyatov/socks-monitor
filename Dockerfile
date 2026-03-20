# Stage 1: Frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Go build
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || true
COPY cmd/ cmd/
COPY internal/ internal/
RUN go mod tidy && CGO_ENABLED=0 go build -o server ./cmd/server/

# Stage 3: Runtime
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=frontend /app/frontend/dist ./static/
EXPOSE 8080
CMD ["./server"]
