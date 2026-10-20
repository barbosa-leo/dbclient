package middleware

import (
	"encoding/json"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type RateLimiterConfig struct {
	Enabled   bool
	APIRate   int
	AuthRate  int
	QueryRate int
}

type clientBucket struct {
	tokens     float64
	lastUpdate time.Time
}

type RateLimiter struct {
	mu            sync.Mutex
	stopOnce      sync.Once
	enabled       bool
	apiRate       float64
	apiBurst      float64
	authRate      float64
	authBurst     float64
	queryRate     float64
	queryBurst    float64
	buckets       map[string]*clientBucket
	cleanupTicker *time.Ticker
	done          chan struct{}
}

func NewRateLimiter(cfg RateLimiterConfig) *RateLimiter {
	apiBurst := float64(cfg.APIRate)
	if apiBurst <= 0 {
		apiBurst = 120
	}
	apiRate := apiBurst / 60.0

	authBurst := float64(cfg.AuthRate)
	if authBurst <= 0 {
		authBurst = 10
	}
	authRate := authBurst / 60.0

	queryBurst := float64(cfg.QueryRate)
	if queryBurst <= 0 {
		queryBurst = 60
	}
	queryRate := queryBurst / 60.0

	ticker := time.NewTicker(5 * time.Minute)
	rl := &RateLimiter{
		enabled:       cfg.Enabled,
		apiRate:       apiRate,
		apiBurst:      apiBurst,
		authRate:      authRate,
		authBurst:     authBurst,
		queryRate:     queryRate,
		queryBurst:    queryBurst,
		buckets:       make(map[string]*clientBucket),
		cleanupTicker: ticker,
		done:          make(chan struct{}),
	}

	go rl.cleanupLoop(ticker)
	return rl
}

func (rl *RateLimiter) Stop() {
	rl.stopOnce.Do(func() {
		rl.cleanupTicker.Stop()
		close(rl.done)
	})
}

func (rl *RateLimiter) cleanupLoop(ticker *time.Ticker) {
	for {
		select {
		case <-rl.done:
			return
		case now := <-ticker.C:
			rl.cleanup(now)
		}
	}
}

func (rl *RateLimiter) cleanup(now time.Time) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for key, b := range rl.buckets {
		if now.Sub(b.lastUpdate) > 5*time.Minute {
			delete(rl.buckets, key)
		}
	}
}

func (rl *RateLimiter) allow(key string, rate, burst float64, now time.Time) (bool, int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[key]
	if !ok {
		rl.buckets[key] = &clientBucket{
			tokens:     burst - 1,
			lastUpdate: now,
		}
		return true, 0
	}

	elapsed := now.Sub(b.lastUpdate).Seconds()
	b.lastUpdate = now
	b.tokens += elapsed * rate
	if b.tokens > burst {
		b.tokens = burst
	}

	if b.tokens >= 1 {
		b.tokens -= 1
		return true, 0
	}

	missing := 1.0 - b.tokens
	retryAfter := int(math.Ceil(missing / rate))
	if retryAfter < 1 {
		retryAfter = 1
	}
	return false, retryAfter
}

func (rl *RateLimiter) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !rl.enabled {
				next.ServeHTTP(w, r)
				return
			}

			if !strings.HasPrefix(r.URL.Path, "/api/") {
				next.ServeHTTP(w, r)
				return
			}

			ip := ExtractClientIP(r)
			now := time.Now()

			if r.Method == http.MethodPost && (r.URL.Path == "/api/auth/login" || r.URL.Path == "/api/auth/login/") {
				allowed, retryAfter := rl.allow("auth:"+ip, rl.authRate, rl.authBurst, now)
				if !allowed {
					writeRateLimitResponse(w, retryAfter, "Muitas tentativas de login. Aguarde antes de tentar novamente.")
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			if isQueryRequest(r) {
				allowed, retryAfter := rl.allow("query:"+ip, rl.queryRate, rl.queryBurst, now)
				if !allowed {
					writeRateLimitResponse(w, retryAfter, "Limite de consultas excedido. Aguarde antes de executar novas consultas.")
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			allowed, retryAfter := rl.allow("api:"+ip, rl.apiRate, rl.apiBurst, now)
			if !allowed {
				writeRateLimitResponse(w, retryAfter, "Limite de requisições excedido. Tente novamente mais tarde.")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func isQueryRequest(r *http.Request) bool {
	if r.Method != http.MethodPost {
		return false
	}
	p := strings.TrimSuffix(r.URL.Path, "/")
	if !strings.HasPrefix(p, "/api/connections/") || !strings.HasSuffix(p, "/query") {
		return false
	}
	idPart := strings.TrimSuffix(strings.TrimPrefix(p, "/api/connections/"), "/query")
	return len(idPart) > 0 && !strings.Contains(idPart, "/")
}

func writeRateLimitResponse(w http.ResponseWriter, retryAfter int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
	w.WriteHeader(http.StatusTooManyRequests)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}

func ExtractClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if idx := strings.Index(xff, ","); idx != -1 {
			if ip := strings.TrimSpace(xff[:idx]); ip != "" {
				return ip
			}
		} else if ip := strings.TrimSpace(xff); ip != "" {
			return ip
		}
	}
	if xrip := strings.TrimSpace(r.Header.Get("X-Real-IP")); xrip != "" {
		return xrip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}
