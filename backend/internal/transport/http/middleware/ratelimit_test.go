package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"dbclient/backend/internal/transport/http/middleware"
)

func TestRateLimiter_AllowsWithinLimit(t *testing.T) {
	limiter := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		Enabled:  true,
		APIRate:  10,
		AuthRate: 5,
	})
	defer limiter.Stop()

	handler := limiter.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 10; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/connections", nil)
		req.RemoteAddr = "192.168.1.1:1234"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200 on request %d, got %d", i+1, rec.Code)
		}
	}
}

func TestRateLimiter_BlocksExceededLimit(t *testing.T) {
	limiter := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		Enabled:  true,
		APIRate:  3,
		AuthRate: 3,
	})
	defer limiter.Stop()

	handler := limiter.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
		req.RemoteAddr = "10.0.0.1:5000"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200 on request %d, got %d", i+1, rec.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	req.RemoteAddr = "10.0.0.1:5000"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429, got %d", rec.Code)
	}

	if retryAfter := rec.Header().Get("Retry-After"); retryAfter == "" {
		t.Fatal("expected Retry-After header to be present")
	}
}

func TestRateLimiter_AuthSpecificLimit(t *testing.T) {
	limiter := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		Enabled:  true,
		APIRate:  100,
		AuthRate: 2,
	})
	defer limiter.Stop()

	handler := limiter.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
		req.RemoteAddr = "172.16.0.5:9000"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200 on login %d, got %d", i+1, rec.Code)
		}
	}

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	req.RemoteAddr = "172.16.0.5:9000"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429 on 3rd login attempt, got %d", rec.Code)
	}

	apiReq := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	apiReq.RemoteAddr = "172.16.0.5:9000"
	apiRec := httptest.NewRecorder()
	handler.ServeHTTP(apiRec, apiReq)

	if apiRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for regular api despite auth limit, got %d", apiRec.Code)
	}
}

func TestRateLimiter_BypassesNonAPI(t *testing.T) {
	limiter := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		Enabled:  true,
		APIRate:  1,
		AuthRate: 1,
	})
	defer limiter.Stop()

	handler := limiter.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		req.RemoteAddr = "192.168.1.100:1234"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200 for /healthz, got %d", rec.Code)
		}
	}

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/index.html", nil)
		req.RemoteAddr = "192.168.1.100:1234"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200 for static asset, got %d", rec.Code)
		}
	}
}

func TestRateLimiter_Disabled(t *testing.T) {
	limiter := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		Enabled:  false,
		APIRate:  1,
		AuthRate: 1,
	})
	defer limiter.Stop()

	handler := limiter.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/connections", nil)
		req.RemoteAddr = "192.168.1.200:1234"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200 when disabled, got %d", rec.Code)
		}
	}
}

func TestRateLimiter_QuerySpecificLimit(t *testing.T) {
	limiter := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		Enabled:   true,
		APIRate:   10,
		AuthRate:  5,
		QueryRate: 2,
	})
	defer limiter.Stop()

	handler := limiter.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/connections/conn-1/query", nil)
		req.RemoteAddr = "10.0.0.50:9000"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200 on query %d, got %d", i+1, rec.Code)
		}
	}

	req := httptest.NewRequest(http.MethodPost, "/api/connections/conn-1/query", nil)
	req.RemoteAddr = "10.0.0.50:9000"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429 on 3rd query attempt, got %d", rec.Code)
	}

	apiReq := httptest.NewRequest(http.MethodGet, "/api/connections", nil)
	apiReq.RemoteAddr = "10.0.0.50:9000"
	apiRec := httptest.NewRecorder()
	handler.ServeHTTP(apiRec, apiReq)

	if apiRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for regular api despite query limit, got %d", apiRec.Code)
	}
}

func TestRateLimiter_IPExtractionHeaders(t *testing.T) {
	limiter := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		Enabled:        true,
		APIRate:        1,
		AuthRate:       1,
		TrustedProxies: "127.0.0.1",
	})
	defer limiter.Stop()

	handler := limiter.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req1 := httptest.NewRequest(http.MethodGet, "/api/environments", nil)
	req1.Header.Set("X-Forwarded-For", "203.0.113.195, 70.41.3.18")
	req1.RemoteAddr = "127.0.0.1:8080"
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusOK {
		t.Fatalf("expected 200 for IP 1, got %d", rec1.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/environments", nil)
	req2.Header.Set("X-Forwarded-For", "198.51.100.17")
	req2.RemoteAddr = "127.0.0.1:8080"
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 for IP 2, got %d", rec2.Code)
	}
}

func TestRateLimiter_UntrustedProxyIgnoresForwardedHeaders(t *testing.T) {
	limiter := middleware.NewRateLimiter(middleware.RateLimiterConfig{
		Enabled:        true,
		APIRate:        1,
		AuthRate:       1,
		TrustedProxies: "",
	})
	defer limiter.Stop()

	handler := limiter.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req1 := httptest.NewRequest(http.MethodGet, "/api/environments", nil)
	req1.Header.Set("X-Forwarded-For", "203.0.113.195")
	req1.RemoteAddr = "10.0.0.1:8080"
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusOK {
		t.Fatalf("expected 200 for first request, got %d", rec1.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/environments", nil)
	req2.Header.Set("X-Forwarded-For", "198.51.100.17")
	req2.RemoteAddr = "10.0.0.1:8080"
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 because untrusted proxy uses RemoteAddr, got %d", rec2.Code)
	}
}

