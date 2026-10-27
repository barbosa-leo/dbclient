//go:build windows

package main

import (
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
)

// The web UI keeps state in localStorage, which is scoped by origin (including the port),
// so the same port is reused across launches whenever it is free.
func preferredPort(portFile string) (int, error) {
	if raw, err := os.ReadFile(portFile); err == nil {
		if port, err := strconv.Atoi(strings.TrimSpace(string(raw))); err == nil && isPortFree(port) {
			return port, nil
		}
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, fmt.Errorf("nenhuma porta local disponível: %w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	_ = listener.Close()

	_ = os.WriteFile(portFile, []byte(strconv.Itoa(port)), 0o600)
	return port, nil
}

func isPortFree(port int) bool {
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	_ = listener.Close()
	return true
}
