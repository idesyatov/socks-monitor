package scheduler

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/idesyatov/socks-monitor/internal/checker"
	"github.com/idesyatov/socks-monitor/internal/sse"
	"github.com/idesyatov/socks-monitor/internal/storage"
)

type Scheduler struct {
	store   *storage.Store
	runner  *checker.Runner
	broker  *sse.Broker
	stop    chan struct{}
	stopped chan struct{}
}

func New(store *storage.Store, runner *checker.Runner, broker *sse.Broker) *Scheduler {
	return &Scheduler{
		store:   store,
		runner:  runner,
		broker:  broker,
		stop:    make(chan struct{}),
		stopped: make(chan struct{}),
	}
}

func (s *Scheduler) Start() {
	defer close(s.stopped)

	interval := s.readInterval()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	refreshTicker := time.NewTicker(5 * time.Minute)
	defer refreshTicker.Stop()

	cleanupTicker := time.NewTicker(1 * time.Hour)
	defer cleanupTicker.Stop()

	resolveIPTicker := time.NewTicker(1 * time.Hour)
	defer resolveIPTicker.Stop()

	log.Printf("scheduler: started, check interval %v", interval)

	for {
		select {
		case <-s.stop:
			log.Println("scheduler: stopping")
			return
		case <-ticker.C:
			log.Println("scheduler: running checks")
			if err := s.runner.RunAll(context.Background()); err != nil {
				log.Printf("scheduler: checks error: %v", err)
			}
		case <-refreshTicker.C:
			newInterval := s.readInterval()
			if newInterval != interval {
				interval = newInterval
				ticker.Reset(interval)
				log.Printf("scheduler: interval updated to %v", interval)
			}
		case <-cleanupTicker.C:
			s.cleanup()
		case <-resolveIPTicker.C:
			s.resolveExitIPs()
		}
	}
}

func (s *Scheduler) Stop() {
	close(s.stop)
	<-s.stopped
}

func (s *Scheduler) readInterval() time.Duration {
	val, err := s.store.GetSetting("check_interval_sec")
	if err == nil {
		if sec, err := strconv.Atoi(val); err == nil && sec > 0 {
			return time.Duration(sec) * time.Second
		}
	}
	return 300 * time.Second
}

func (s *Scheduler) resolveExitIPs() {
	proxies, err := s.store.ListEnabledProxies()
	if err != nil {
		log.Printf("resolve IPs: list error: %v", err)
		return
	}
	serviceURL, _ := s.store.GetSetting("exit_ip_service_url")
	if serviceURL == "" {
		serviceURL = "https://ifconfig.me"
	}
	for _, p := range proxies {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		ip, err := checker.ResolveExitIP(ctx, p, serviceURL, 15*time.Second)
		cancel()
		if err != nil {
			log.Printf("resolve IP proxy %d: %v", p.ID, err)
			continue
		}
		s.store.UpdateProxyExitIP(p.ID, ip)
		data := fmt.Sprintf(`{"proxy_id":%d,"exit_ip":"%s","updated_at":"%s"}`, p.ID, ip, time.Now().UTC().Format(time.RFC3339))
		s.broker.Publish("exit_ip_resolved", []byte(data))
		log.Printf("resolve IP proxy %d: %s", p.ID, ip)
	}
}

func (s *Scheduler) cleanup() {
	val, err := s.store.GetSetting("history_retention_days")
	if err != nil {
		return
	}
	days, err := strconv.Atoi(val)
	if err != nil || days <= 0 {
		return
	}
	deleted, err := s.store.CleanupOldResults(days)
	if err != nil {
		log.Printf("cleanup: error: %v", err)
		return
	}
	if deleted > 0 {
		log.Printf("cleanup: deleted %d old check results", deleted)
	}
}
