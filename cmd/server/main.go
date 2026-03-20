package main

import (
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/idesyatov/socks-monitor/internal/api"
	"github.com/idesyatov/socks-monitor/internal/checker"
	"github.com/idesyatov/socks-monitor/internal/scheduler"
	"github.com/idesyatov/socks-monitor/internal/sse"
	"github.com/idesyatov/socks-monitor/internal/storage"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/dashboard.db"
	}

	os.MkdirAll("./data", 0755)
	if dir := filepath.Dir(dbPath); dir != "" {
		os.MkdirAll(dir, 0755)
	}

	store, err := storage.New(dbPath)
	if err != nil {
		log.Fatalf("storage init: %v", err)
	}
	defer store.Close()

	broker := sse.NewBroker()
	go broker.Start()

	runner := checker.NewRunner(store, broker, 10)

	sched := scheduler.New(store, runner, broker)
	go sched.Start()

	app := fiber.New(fiber.Config{
		AppName: "Socks Monitor",
	})
	app.Use(logger.New())

	app.Static("/", "./static")

	handler := api.NewHandler(store, runner, broker)
	api.SetupRoutes(app, handler)

	app.Get("/*", func(c *fiber.Ctx) error {
		return c.SendFile("./static/index.html")
	})

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	listenAddr := host + ":" + port
	log.Printf("Starting server on %s", listenAddr)

	go func() {
		if err := app.Listen(listenAddr); err != nil {
			log.Fatalf("server: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down...")
	sched.Stop()
	app.Shutdown()
}
