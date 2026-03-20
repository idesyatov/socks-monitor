package models

import "time"

type Proxy struct {
	ID              int64      `json:"id"`
	Name            string     `json:"name"`
	Host            string     `json:"host"`
	Port            int        `json:"port"`
	Username        string     `json:"username,omitempty"`
	Password        string     `json:"password,omitempty"`
	Enabled         bool       `json:"enabled"`
	CreatedAt       time.Time  `json:"created_at"`
	ExitIP          string     `json:"exit_ip,omitempty"`
	ExitIPUpdatedAt *time.Time `json:"exit_ip_updated_at,omitempty"`
}

type Target struct {
	ID      int64  `json:"id"`
	URL     string `json:"url"`
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
}

type CheckResult struct {
	ID        int64     `json:"id"`
	ProxyID   int64     `json:"proxy_id"`
	TargetID  int64     `json:"target_id"`
	Status    string    `json:"status"`
	LatencyMs *int64    `json:"latency_ms"`
	ErrorMsg  string    `json:"error_msg,omitempty"`
	CheckedAt time.Time `json:"checked_at"`
}

type ProxyWithChecks struct {
	Proxy  Proxy              `json:"proxy"`
	Checks []LatestCheckEntry `json:"checks"`
}

type LatestCheckEntry struct {
	Target    Target    `json:"target"`
	Status    string    `json:"status"`
	LatencyMs *int64    `json:"latency_ms"`
	CheckedAt time.Time `json:"checked_at"`
}
