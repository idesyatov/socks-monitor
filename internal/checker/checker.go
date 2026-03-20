package checker

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/idesyatov/socks-monitor/internal/models"
	"golang.org/x/net/proxy"
)

func CheckProxy(ctx context.Context, p models.Proxy, t models.Target, timeout time.Duration) models.CheckResult {
	result := models.CheckResult{
		ProxyID:  p.ID,
		TargetID: t.ID,
	}

	addr := fmt.Sprintf("%s:%d", p.Host, p.Port)

	var auth *proxy.Auth
	if p.Username != "" {
		auth = &proxy.Auth{User: p.Username, Password: p.Password}
	}

	dialer, err := proxy.SOCKS5("tcp", addr, auth, proxy.Direct)
	if err != nil {
		result.Status = "error"
		result.ErrorMsg = fmt.Sprintf("socks5 dial setup: %v", err)
		return result
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			return dialer.Dial(network, addr)
		},
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   timeout,
	}

	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, t.URL, nil)
	if err != nil {
		result.Status = "error"
		result.ErrorMsg = fmt.Sprintf("request build: %v", err)
		return result
	}

	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()

	if err != nil {
		result.Status = "down"
		result.ErrorMsg = err.Error()
		return result
	}
	defer resp.Body.Close()

	result.LatencyMs = &latency
	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		result.Status = "up"
	} else {
		result.Status = "down"
		result.ErrorMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	return result
}
