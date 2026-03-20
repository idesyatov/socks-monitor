package storage

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/idesyatov/socks-monitor/internal/models"
	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func New(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	db.Exec("PRAGMA journal_mode=WAL")
	db.Exec("PRAGMA foreign_keys=ON")
	if err := RunMigrations(db); err != nil {
		return nil, fmt.Errorf("migrations: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

// --- Proxies ---

func (s *Store) ListProxies() ([]models.Proxy, error) {
	rows, err := s.db.Query("SELECT id, name, host, port, username, password, enabled, created_at, exit_ip, exit_ip_updated_at FROM proxies ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []models.Proxy
	for rows.Next() {
		var p models.Proxy
		var exitIP sql.NullString
		var exitIPUpdatedAt sql.NullTime
		if err := rows.Scan(&p.ID, &p.Name, &p.Host, &p.Port, &p.Username, &p.Password, &p.Enabled, &p.CreatedAt, &exitIP, &exitIPUpdatedAt); err != nil {
			return nil, err
		}
		if exitIP.Valid {
			p.ExitIP = exitIP.String
		}
		if exitIPUpdatedAt.Valid {
			p.ExitIPUpdatedAt = &exitIPUpdatedAt.Time
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func (s *Store) GetProxy(id int64) (models.Proxy, error) {
	var p models.Proxy
	var exitIP sql.NullString
	var exitIPUpdatedAt sql.NullTime
	err := s.db.QueryRow("SELECT id, name, host, port, username, password, enabled, created_at, exit_ip, exit_ip_updated_at FROM proxies WHERE id=?", id).
		Scan(&p.ID, &p.Name, &p.Host, &p.Port, &p.Username, &p.Password, &p.Enabled, &p.CreatedAt, &exitIP, &exitIPUpdatedAt)
	if exitIP.Valid {
		p.ExitIP = exitIP.String
	}
	if exitIPUpdatedAt.Valid {
		p.ExitIPUpdatedAt = &exitIPUpdatedAt.Time
	}
	return p, err
}

func (s *Store) CreateProxy(p *models.Proxy) error {
	res, err := s.db.Exec(
		"INSERT INTO proxies (name, host, port, username, password, enabled) VALUES (?,?,?,?,?,?)",
		p.Name, p.Host, p.Port, p.Username, p.Password, p.Enabled,
	)
	if err != nil {
		return err
	}
	p.ID, _ = res.LastInsertId()
	p.CreatedAt = time.Now()
	return nil
}

func (s *Store) UpdateProxy(p *models.Proxy) error {
	_, err := s.db.Exec(
		"UPDATE proxies SET name=?, host=?, port=?, username=?, password=?, enabled=? WHERE id=?",
		p.Name, p.Host, p.Port, p.Username, p.Password, p.Enabled, p.ID,
	)
	return err
}

func (s *Store) DeleteProxy(id int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	tx.Exec("DELETE FROM check_results WHERE proxy_id=?", id)
	tx.Exec("DELETE FROM proxies WHERE id=?", id)
	return tx.Commit()
}

func (s *Store) UpdateProxyExitIP(proxyID int64, exitIP string) error {
	_, err := s.db.Exec("UPDATE proxies SET exit_ip=?, exit_ip_updated_at=CURRENT_TIMESTAMP WHERE id=?", exitIP, proxyID)
	return err
}

// --- Targets ---

func (s *Store) ListTargets() ([]models.Target, error) {
	rows, err := s.db.Query("SELECT id, url, name, enabled FROM targets ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []models.Target
	for rows.Next() {
		var t models.Target
		if err := rows.Scan(&t.ID, &t.URL, &t.Name, &t.Enabled); err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}

func (s *Store) GetTarget(id int64) (models.Target, error) {
	var t models.Target
	err := s.db.QueryRow("SELECT id, url, name, enabled FROM targets WHERE id=?", id).
		Scan(&t.ID, &t.URL, &t.Name, &t.Enabled)
	return t, err
}

func (s *Store) CreateTarget(t *models.Target) error {
	res, err := s.db.Exec(
		"INSERT INTO targets (url, name, enabled) VALUES (?,?,?)",
		t.URL, t.Name, t.Enabled,
	)
	if err != nil {
		return err
	}
	t.ID, _ = res.LastInsertId()
	return nil
}

func (s *Store) UpdateTarget(t *models.Target) error {
	_, err := s.db.Exec(
		"UPDATE targets SET url=?, name=?, enabled=? WHERE id=?",
		t.URL, t.Name, t.Enabled, t.ID,
	)
	return err
}

func (s *Store) DeleteTarget(id int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	tx.Exec("DELETE FROM check_results WHERE target_id=?", id)
	tx.Exec("DELETE FROM targets WHERE id=?", id)
	return tx.Commit()
}

// --- Check Results ---

func (s *Store) SaveCheckResult(r *models.CheckResult) error {
	res, err := s.db.Exec(
		"INSERT INTO check_results (proxy_id, target_id, status, latency_ms, error_msg) VALUES (?,?,?,?,?)",
		r.ProxyID, r.TargetID, r.Status, r.LatencyMs, r.ErrorMsg,
	)
	if err != nil {
		return err
	}
	r.ID, _ = res.LastInsertId()
	r.CheckedAt = time.Now()
	return nil
}

func (s *Store) GetLatestChecks() ([]models.ProxyWithChecks, error) {
	proxies, err := s.ListProxies()
	if err != nil {
		return nil, err
	}
	targets, err := s.ListTargets()
	if err != nil {
		return nil, err
	}

	var result []models.ProxyWithChecks
	for _, p := range proxies {
		if !p.Enabled {
			continue
		}
		pwc := models.ProxyWithChecks{Proxy: p}
		for _, t := range targets {
			if !t.Enabled {
				continue
			}
			var cr models.LatestCheckEntry
			cr.Target = t
			var latency sql.NullInt64
			var checkedAt sql.NullTime
			err := s.db.QueryRow(
				"SELECT status, latency_ms, checked_at FROM check_results WHERE proxy_id=? AND target_id=? ORDER BY checked_at DESC LIMIT 1",
				p.ID, t.ID,
			).Scan(&cr.Status, &latency, &checkedAt)
			if err == sql.ErrNoRows {
				cr.Status = "unknown"
			} else if err != nil {
				return nil, err
			} else {
				if latency.Valid {
					cr.LatencyMs = &latency.Int64
				}
				if checkedAt.Valid {
					cr.CheckedAt = checkedAt.Time
				}
			}
			pwc.Checks = append(pwc.Checks, cr)
		}
		result = append(result, pwc)
	}
	return result, nil
}

func (s *Store) ListEnabledProxies() ([]models.Proxy, error) {
	rows, err := s.db.Query("SELECT id, name, host, port, username, password, enabled, created_at, exit_ip, exit_ip_updated_at FROM proxies WHERE enabled=1 ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []models.Proxy
	for rows.Next() {
		var p models.Proxy
		var exitIP sql.NullString
		var exitIPUpdatedAt sql.NullTime
		if err := rows.Scan(&p.ID, &p.Name, &p.Host, &p.Port, &p.Username, &p.Password, &p.Enabled, &p.CreatedAt, &exitIP, &exitIPUpdatedAt); err != nil {
			return nil, err
		}
		if exitIP.Valid {
			p.ExitIP = exitIP.String
		}
		if exitIPUpdatedAt.Valid {
			p.ExitIPUpdatedAt = &exitIPUpdatedAt.Time
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func (s *Store) ListEnabledTargets() ([]models.Target, error) {
	rows, err := s.db.Query("SELECT id, url, name, enabled FROM targets WHERE enabled=1 ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []models.Target
	for rows.Next() {
		var t models.Target
		if err := rows.Scan(&t.ID, &t.URL, &t.Name, &t.Enabled); err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}

// --- Settings ---

func (s *Store) GetSetting(key string) (string, error) {
	var val string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key=?", key).Scan(&val)
	return val, err
}

func (s *Store) SetSetting(key, value string) error {
	_, err := s.db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", key, value)
	return err
}

func (s *Store) GetAllSettings() (map[string]string, error) {
	rows, err := s.db.Query("SELECT key, value FROM settings ORDER BY key")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		result[k] = v
	}
	return result, rows.Err()
}

// --- History ---

type HistoryFilter struct {
	ProxyID  *int64
	TargetID *int64
	From     *time.Time
	To       *time.Time
	Limit    int
}

func (s *Store) GetCheckHistory(f HistoryFilter) ([]models.CheckResult, error) {
	query := "SELECT id, proxy_id, target_id, status, latency_ms, error_msg, checked_at FROM check_results WHERE 1=1"
	var args []interface{}

	if f.ProxyID != nil {
		query += " AND proxy_id=?"
		args = append(args, *f.ProxyID)
	}
	if f.TargetID != nil {
		query += " AND target_id=?"
		args = append(args, *f.TargetID)
	}
	if f.From != nil {
		query += " AND checked_at >= ?"
		args = append(args, *f.From)
	}
	if f.To != nil {
		query += " AND checked_at <= ?"
		args = append(args, *f.To)
	}

	query += " ORDER BY checked_at DESC"

	limit := f.Limit
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	query += " LIMIT ?"
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.CheckResult
	for rows.Next() {
		var cr models.CheckResult
		var latency sql.NullInt64
		if err := rows.Scan(&cr.ID, &cr.ProxyID, &cr.TargetID, &cr.Status, &latency, &cr.ErrorMsg, &cr.CheckedAt); err != nil {
			return nil, err
		}
		if latency.Valid {
			cr.LatencyMs = &latency.Int64
		}
		result = append(result, cr)
	}
	return result, rows.Err()
}

// --- Cleanup ---

func (s *Store) CleanupOldResults(retentionDays int) (int64, error) {
	res, err := s.db.Exec("DELETE FROM check_results WHERE checked_at < datetime('now', ?)", fmt.Sprintf("-%d days", retentionDays))
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
