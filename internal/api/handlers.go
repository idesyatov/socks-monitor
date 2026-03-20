package api

import (
	"bufio"
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/idesyatov/socks-monitor/internal/checker"
	"github.com/idesyatov/socks-monitor/internal/models"
	"github.com/idesyatov/socks-monitor/internal/sse"
	"github.com/idesyatov/socks-monitor/internal/storage"
)

type Handler struct {
	store  *storage.Store
	runner *checker.Runner
	broker *sse.Broker
}

func NewHandler(store *storage.Store, runner *checker.Runner, broker *sse.Broker) *Handler {
	return &Handler{store: store, runner: runner, broker: broker}
}

// --- Proxies ---

func (h *Handler) ListProxies(c *fiber.Ctx) error {
	proxies, err := h.store.ListProxies()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if proxies == nil {
		proxies = []models.Proxy{}
	}
	return c.JSON(proxies)
}

func (h *Handler) GetProxy(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	p, err := h.store.GetProxy(id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "proxy not found"})
	}
	return c.JSON(p)
}

func (h *Handler) CreateProxy(c *fiber.Ctx) error {
	var p models.Proxy
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid json"})
	}
	if p.Host == "" || p.Port == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "host and port are required"})
	}
	p.Enabled = true
	if err := h.store.CreateProxy(&p); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(p)
}

func (h *Handler) UpdateProxy(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	existing, err := h.store.GetProxy(id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "proxy not found"})
	}
	if err := c.BodyParser(&existing); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid json"})
	}
	existing.ID = id
	if err := h.store.UpdateProxy(&existing); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(existing)
}

func (h *Handler) DeleteProxy(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	if err := h.store.DeleteProxy(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// --- Targets ---

func (h *Handler) ListTargets(c *fiber.Ctx) error {
	targets, err := h.store.ListTargets()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if targets == nil {
		targets = []models.Target{}
	}
	return c.JSON(targets)
}

func (h *Handler) CreateTarget(c *fiber.Ctx) error {
	var t models.Target
	if err := c.BodyParser(&t); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid json"})
	}
	if t.URL == "" {
		return c.Status(400).JSON(fiber.Map{"error": "url is required"})
	}
	t.Enabled = true
	if err := h.store.CreateTarget(&t); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(t)
}

func (h *Handler) UpdateTarget(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	existing, err := h.store.GetTarget(id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "target not found"})
	}
	if err := c.BodyParser(&existing); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid json"})
	}
	existing.ID = id
	if err := h.store.UpdateTarget(&existing); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(existing)
}

func (h *Handler) DeleteTarget(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	if err := h.store.DeleteTarget(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// --- Checks ---

func (h *Handler) RunChecks(c *fiber.Ctx) error {
	type req struct {
		ProxyID *int64 `json:"proxy_id"`
	}
	var r req
	c.BodyParser(&r)

	if r.ProxyID != nil {
		go h.runner.RunForProxy(context.Background(), *r.ProxyID)
	} else {
		go h.runner.RunAll(context.Background())
	}

	return c.Status(202).JSON(fiber.Map{"status": "checks started"})
}

func (h *Handler) LatestChecks(c *fiber.Ctx) error {
	results, err := h.store.GetLatestChecks()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if results == nil {
		results = []models.ProxyWithChecks{}
	}
	return c.JSON(results)
}

func (h *Handler) CheckHistory(c *fiber.Ctx) error {
	var f storage.HistoryFilter

	if v := c.Query("proxy_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			f.ProxyID = &id
		}
	}
	if v := c.Query("target_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			f.TargetID = &id
		}
	}
	if v := c.Query("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err == nil {
			f.From = &t
		}
	}
	if v := c.Query("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err == nil {
			f.To = &t
		}
	}
	f.Limit = c.QueryInt("limit", 100)

	results, err := h.store.GetCheckHistory(f)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if results == nil {
		results = []models.CheckResult{}
	}
	return c.JSON(results)
}

// --- SSE ---

func (h *Handler) SSEEvents(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")

	ch := h.broker.Subscribe()

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer h.broker.Unsubscribe(ch)
		for {
			msg, ok := <-ch
			if !ok {
				return
			}
			if _, err := w.Write(msg); err != nil {
				return
			}
			if err := w.Flush(); err != nil {
				return
			}
		}
	})

	return nil
}

// --- Exit IP ---

func (h *Handler) ResolveExitIP(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	if _, err := h.store.GetProxy(id); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "proxy not found"})
	}
	go h.resolveExitIPForProxy(id)
	return c.Status(202).JSON(fiber.Map{"status": "resolving"})
}

func (h *Handler) ResolveAllExitIPs(c *fiber.Ctx) error {
	go h.resolveAllExitIPs()
	return c.Status(202).JSON(fiber.Map{"status": "resolving all"})
}

func (h *Handler) resolveExitIPForProxy(proxyID int64) {
	p, err := h.store.GetProxy(proxyID)
	if err != nil {
		return
	}
	serviceURL, _ := h.store.GetSetting("exit_ip_service_url")
	if serviceURL == "" {
		serviceURL = "https://ifconfig.me"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	ip, err := checker.ResolveExitIP(ctx, p, serviceURL, 15*time.Second)
	if err != nil {
		return
	}
	h.store.UpdateProxyExitIP(p.ID, ip)
	data := fmt.Sprintf(`{"proxy_id":%d,"exit_ip":"%s","updated_at":"%s"}`, p.ID, ip, time.Now().UTC().Format(time.RFC3339))
	h.broker.Publish("exit_ip_resolved", []byte(data))
}

func (h *Handler) resolveAllExitIPs() {
	proxies, err := h.store.ListEnabledProxies()
	if err != nil {
		return
	}
	for _, p := range proxies {
		h.resolveExitIPForProxy(p.ID)
	}
}

// --- Settings ---

func (h *Handler) GetSettings(c *fiber.Ctx) error {
	settings, err := h.store.GetAllSettings()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(settings)
}

func (h *Handler) UpdateSettings(c *fiber.Ctx) error {
	var body map[string]string
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid json"})
	}
	for k, v := range body {
		if err := h.store.SetSetting(k, v); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("setting %s: %v", k, err)})
		}
	}
	return h.GetSettings(c)
}
