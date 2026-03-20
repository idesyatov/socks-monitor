package checker

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/idesyatov/socks-monitor/internal/models"
	"github.com/idesyatov/socks-monitor/internal/sse"
	"github.com/idesyatov/socks-monitor/internal/storage"
)

type Runner struct {
	store      *storage.Store
	broker     *sse.Broker
	maxWorkers int
}

func NewRunner(store *storage.Store, broker *sse.Broker, maxWorkers int) *Runner {
	return &Runner{store: store, broker: broker, maxWorkers: maxWorkers}
}

func (r *Runner) RunAll(ctx context.Context) error {
	proxies, err := r.store.ListEnabledProxies()
	if err != nil {
		return err
	}
	targets, err := r.store.ListEnabledTargets()
	if err != nil {
		return err
	}
	r.run(ctx, proxies, targets)
	return nil
}

func (r *Runner) RunForProxy(ctx context.Context, proxyID int64) error {
	p, err := r.store.GetProxy(proxyID)
	if err != nil {
		return err
	}
	targets, err := r.store.ListEnabledTargets()
	if err != nil {
		return err
	}
	r.run(ctx, []models.Proxy{p}, targets)
	return nil
}

func (r *Runner) run(ctx context.Context, proxies []models.Proxy, targets []models.Target) {
	if len(proxies) == 0 || len(targets) == 0 {
		return
	}

	startedData, _ := json.Marshal(map[string]int{
		"proxy_count":  len(proxies),
		"target_count": len(targets),
	})
	r.broker.Publish("check_started", startedData)

	timeoutStr, _ := r.store.GetSetting("check_timeout_sec")
	timeoutSec, err := strconv.Atoi(timeoutStr)
	if err != nil || timeoutSec <= 0 {
		timeoutSec = 10
	}
	timeout := time.Duration(timeoutSec) * time.Second

	var wg sync.WaitGroup
	sem := make(chan struct{}, r.maxWorkers)

	for _, p := range proxies {
		for _, t := range targets {
			wg.Add(1)
			sem <- struct{}{}
			go func(p models.Proxy, t models.Target) {
				defer wg.Done()
				defer func() { <-sem }()
				checkCtx, cancel := context.WithTimeout(ctx, timeout)
				defer cancel()
				result := CheckProxy(checkCtx, p, t, timeout)
				if err := r.store.SaveCheckResult(&result); err != nil {
					log.Printf("save check result: %v", err)
					return
				}
				data, _ := json.Marshal(result)
				r.broker.Publish("check_complete", data)
			}(p, t)
		}
	}
	wg.Wait()
}
