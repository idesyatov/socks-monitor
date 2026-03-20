# Proxy Dashboard — Architecture

## Назначение
Веб-приложение для мониторинга SOCKS5-прокси: проверка доступности, измерение латентности через настраиваемые целевые URL. Дашборд с текущим статусом и историей проверок. Определение exit IP каждого прокси.

## Стек

| Компонент | Технология | Обоснование |
|-----------|-----------|-------------|
| Backend | Go 1.22+ (Fiber v2) | Быстрый, нативная поддержка SOCKS5 (`golang.org/x/net/proxy`), горутины для параллельных проверок |
| Frontend | React 18 + Vite + TypeScript | SPA, быстрая сборка, TailwindCSS для UI |
| БД | SQLite (через `modernc.org/sqlite`) | Zero-config, pure Go driver (без CGO), достаточно для 10-50 прокси |
| Контейнеризация | Docker (multi-stage build) | Go binary + static frontend assets в одном образе |
| Реалтайм | SSE (Server-Sent Events) | Пуш обновлений проверок в UI без polling |

## Принцип: всё через Docker

**Локальные Go, Node, npm НЕ требуются.** Вся сборка, тестирование и запуск происходят исключительно внутри Docker-контейнеров. На хост-машине нужен только Docker + Docker Compose.

Workflow разработки:
```bash
# Сборка и запуск
docker compose up --build

# Пересборка после изменений
docker compose up --build --force-recreate

# Запуск тестов Go
docker compose run --rm app go test ./...

# Логи
docker compose logs -f
```

## Структура репозитория

```
proxy-dashboard/
├── cmd/
│   └── server/
│       └── main.go              # Entrypoint
├── internal/
│   ├── api/                     # HTTP handlers (Fiber)
│   │   ├── handlers.go
│   │   └── routes.go
│   ├── checker/                 # Логика проверки прокси
│   │   ├── checker.go
│   │   └── runner.go
│   ├── scheduler/               # Cron-like планировщик
│   │   └── scheduler.go
│   ├── models/                  # Структуры данных
│   │   └── models.go
│   ├── storage/                 # SQLite репозиторий
│   │   ├── storage.go
│   │   └── migrations.go
│   └── sse/                     # SSE broadcaster
│       └── broker.go
├── frontend/
│   ├── src/
│   │   ├── components/          # React-компоненты
│   │   ├── hooks/               # Custom hooks (useSSE, useApi)
│   │   ├── pages/               # Dashboard, Settings
│   │   ├── types/               # TypeScript типы
│   │   └── App.tsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── Dockerfile
├── docker-compose.yml
├── go.mod
├── go.sum
├── pm/                          # Project management
├── docs/                        # Документация
└── CLAUDE.md
```

## Схема БД (SQLite)

### proxies
| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Человекочитаемое имя |
| host | TEXT NOT NULL | Адрес SOCKS5 прокси (entry point) |
| port | INTEGER NOT NULL | Порт |
| username | TEXT | Опционально, для auth |
| password | TEXT | Опционально, для auth |
| exit_ip | TEXT | Последний определённый exit IP |
| exit_ip_updated_at | DATETIME | Когда определён exit IP |
| enabled | BOOLEAN DEFAULT 1 | Активна ли проверка |
| created_at | DATETIME | Время добавления |

### targets
| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | Auto-increment |
| url | TEXT NOT NULL | Целевой URL для проверки |
| name | TEXT | Описание |
| enabled | BOOLEAN DEFAULT 1 | Активен ли таргет |

### check_results
| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | Auto-increment |
| proxy_id | INTEGER FK | → proxies.id |
| target_id | INTEGER FK | → targets.id |
| status | TEXT | 'up' / 'down' / 'error' |
| latency_ms | INTEGER | Время ответа в мс (NULL если down) |
| error_msg | TEXT | Текст ошибки при неудаче |
| checked_at | DATETIME | Время проверки |

**Индексы:** `(proxy_id, checked_at)`, `(target_id, checked_at)` для быстрых выборок истории.

### settings
| Поле | Тип | Описание |
|------|-----|----------|
| key | TEXT PK | Ключ настройки |
| value | TEXT | Значение (JSON для сложных) |

Ключи: `check_interval_sec` (default: 60), `check_timeout_sec` (default: 10), `history_retention_days` (default: 7), `exit_ip_service_url` (default: `https://ifconfig.me`).

## Exit IP определение

Каждый SOCKS-прокси имеет entry point (host:port, куда подключаемся) и exit IP (IP-адрес, с которого выходит трафик в интернет). Они могут отличаться.

**Механизм:** HTTP GET на `https://ifconfig.me` (или другой сервис из настройки `exit_ip_service_url`) через SOCKS-прокси. Ответ — текстовый IP-адрес.

**Когда определяется:**
- По кнопке из UI (`POST /api/proxies/:id/resolve-ip` или `POST /api/proxies/resolve-ip` для всех)
- Автоматически раз в час (в scheduler)

**Где хранится:** в таблице `proxies` — поля `exit_ip` и `exit_ip_updated_at`. Обновляется при каждом успешном resolve.

## API Endpoints

### Proxies
- `GET /api/proxies` — список всех прокси с последним статусом и exit IP
- `POST /api/proxies` — добавить прокси
- `PUT /api/proxies/:id` — обновить
- `DELETE /api/proxies/:id` — удалить
- `POST /api/proxies/resolve-ip` — определить exit IP для всех enabled прокси
- `POST /api/proxies/:id/resolve-ip` — определить exit IP для конкретного прокси

### Targets
- `GET /api/targets` — список целевых URL
- `POST /api/targets` — добавить
- `PUT /api/targets/:id` — обновить
- `DELETE /api/targets/:id` — удалить

### Checks
- `POST /api/checks/run` — запустить проверку вручную (все или по proxy_id)
- `GET /api/checks/history?proxy_id=&from=&to=` — история проверок
- `GET /api/checks/latest` — последние результаты по всем прокси

### Realtime
- `GET /api/events` — SSE stream (события: check_complete, check_started, exit_ip_resolved)

### Settings
- `GET /api/settings` — текущие настройки
- `PUT /api/settings` — обновить настройки

## Логика проверки

1. Scheduler запускает проверку по интервалу из `settings.check_interval_sec`
2. Для каждого enabled proxy × enabled target создаётся горутина
3. Checker: устанавливает SOCKS5-соединение → делает HTTP GET на target URL через прокси
4. Замеряет время от начала dial до получения HTTP-ответа (или timeout)
5. Результат пишется в `check_results`, отправляется через SSE

Параллелизм ограничен через `semaphore` (configurable, default: 10 concurrent checks).

## Docker

### Dockerfile (multi-stage)

```dockerfile
# Stage 1: Frontend (placeholder)
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --ignore-scripts 2>/dev/null || true
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
```

### docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
    environment:
      - DB_PATH=/app/data/dashboard.db
    restart: unless-stopped
```

### Команды разработки (все через Docker, без локального Go/Node)

```bash
# Сборка и запуск
docker compose up --build

# Пересборка после изменений кода
docker compose up --build --force-recreate

# Запуск Go-тестов
docker compose run --rm app go test ./...

# Остановка
docker compose down

# Очистка данных (сброс БД)
docker compose down -v && rm -rf data/
```

На хост-машине **не нужно** устанавливать Go, Node, npm. Всё собирается внутри Docker.

## Автоочистка

Background goroutine раз в час удаляет записи из `check_results` старше `history_retention_days`. Настраивается через Settings UI.

## UI Страницы

### Dashboard (главная)
- Карточки прокси: имя, entry point (host:port), exit IP, статус (зелёный/красный), латентность, последняя проверка
- Фильтр: все / up / down
- Кнопка «Проверить все сейчас»
- Кнопка «Resolve IP» (определить exit IP для всех)
- Мини-график латентности за 24ч на каждой карточке (sparkline)

### Proxy Detail
- История проверок по всем targets
- График латентности за выбранный период
- Uptime % за период
- Exit IP с временем последнего определения

### Settings
- CRUD прокси и targets
- Интервал проверки
- Timeout
- Retention period
- URL сервиса для определения exit IP
