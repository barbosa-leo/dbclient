//go:build windows

package main

import "html"

func statusPage(message string) string {
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
    font: 14px "Segoe UI", sans-serif; color: #6b7280; background: #ffffff;
  }
  @media (prefers-color-scheme: dark) { body { background: #111318; color: #9ca3af; } }
  .spinner {
    width: 18px; height: 18px; margin-right: 10px; border-radius: 50%;
    border: 2px solid currentColor; border-right-color: transparent; animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body><div class="spinner"></div>` + html.EscapeString(message) + `</body>
</html>`
}
