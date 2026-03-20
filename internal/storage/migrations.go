package storage

import "database/sql"

func RunMigrations(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS proxies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT,
			host TEXT NOT NULL,
			port INTEGER NOT NULL,
			username TEXT,
			password TEXT,
			enabled BOOLEAN DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS targets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			url TEXT NOT NULL,
			name TEXT,
			enabled BOOLEAN DEFAULT 1
		)`,
		`CREATE TABLE IF NOT EXISTS check_results (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			proxy_id INTEGER NOT NULL REFERENCES proxies(id),
			target_id INTEGER NOT NULL REFERENCES targets(id),
			status TEXT NOT NULL,
			latency_ms INTEGER,
			error_msg TEXT,
			checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_check_results_proxy_time ON check_results(proxy_id, checked_at)`,
		`CREATE INDEX IF NOT EXISTS idx_check_results_target_time ON check_results(target_id, checked_at)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT
		)`,
		`INSERT OR IGNORE INTO settings (key, value) VALUES ('check_interval_sec', '60')`,
		`INSERT OR IGNORE INTO settings (key, value) VALUES ('check_timeout_sec', '10')`,
		`INSERT OR IGNORE INTO settings (key, value) VALUES ('history_retention_days', '7')`,
		`INSERT OR IGNORE INTO settings (key, value) VALUES ('exit_ip_service_url', 'https://ifconfig.me')`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}

	// ALTER TABLE migrations (SQLite doesn't support IF NOT EXISTS for ALTER)
	alterQueries := []string{
		"ALTER TABLE proxies ADD COLUMN exit_ip TEXT",
		"ALTER TABLE proxies ADD COLUMN exit_ip_updated_at DATETIME",
	}
	for _, q := range alterQueries {
		db.Exec(q) // ignore "duplicate column" errors
	}

	return nil
}
