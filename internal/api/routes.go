package api

import "github.com/gofiber/fiber/v2"

func SetupRoutes(app *fiber.App, h *Handler) {
	api := app.Group("/api")

	api.Get("/proxies", h.ListProxies)
	api.Get("/proxies/:id", h.GetProxy)
	api.Post("/proxies", h.CreateProxy)
	api.Put("/proxies/:id", h.UpdateProxy)
	api.Delete("/proxies/:id", h.DeleteProxy)

	api.Get("/targets", h.ListTargets)
	api.Post("/targets", h.CreateTarget)
	api.Put("/targets/:id", h.UpdateTarget)
	api.Delete("/targets/:id", h.DeleteTarget)

	api.Post("/proxies/resolve-ip", h.ResolveAllExitIPs)
	api.Post("/proxies/:id/resolve-ip", h.ResolveExitIP)

	api.Post("/checks/run", h.RunChecks)
	api.Get("/checks/latest", h.LatestChecks)
	api.Get("/checks/history", h.CheckHistory)

	api.Get("/events", h.SSEEvents)

	api.Get("/settings", h.GetSettings)
	api.Put("/settings", h.UpdateSettings)
}
