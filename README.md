# Socks Monitor

Web dashboard for monitoring service availability through SOCKS5 proxies.

Configure a list of SOCKS5 proxies and target URLs (e.g. `api.telegram.org`), automatically check availability of each target through each proxy, and display statuses, latency, and exit IPs in real time.

## Features

- Monitor SOCKS5 proxies with configurable target URLs
- Detect exit IP for each proxy
- Live updates via SSE
- Latency charts and uptime tracking
- Dark/light theme
- Scheduled and manual checks
- Single Docker container

## Quick start

```bash
git clone https://github.com/idesyatov/socks-monitor.git
cd socks-monitor
docker compose up --build -d
```

Open http://localhost:8080

Works out of the box. To change port or bind address — see `.env.example`.

## Usage

1. Go to **Settings** → add SOCKS5 proxies and target URLs
2. **Dashboard** shows live status, latency, and exit IPs
3. Click a proxy card for detailed charts and check history

## Tech stack

Go (Fiber) · SQLite · React · TypeScript · TailwindCSS · Recharts · Docker

## Development

No local Go/Node required — everything through Docker:

```bash
docker compose up --build -d   # build and run
docker compose logs -f          # logs
docker compose down             # stop
docker compose down && rm -rf data/  # reset
```

## License

[MIT](LICENSE)
