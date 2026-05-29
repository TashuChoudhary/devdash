package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	requestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)
	requestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)
)

func init() {
	prometheus.MustRegister(requestsTotal)
	prometheus.MustRegister(requestDuration)
}

func instrument(path string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		h(w, r)
		duration := time.Since(start).Seconds()

		requestsTotal.WithLabelValues(r.Method, path, "200").Inc()
		requestDuration.WithLabelValues(r.Method, path).Observe(duration)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, `{"status":"ok","service":"devdash-app"}`)
}

func main() {
	http.HandleFunc("/health", instrument("/health", healthHandler))

	http.HandleFunc("/", instrument("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "DevDash app is running")
	}))

	// This is the magic endpoint — Prometheus scrapes this
	http.Handle("/metrics", promhttp.Handler())

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
