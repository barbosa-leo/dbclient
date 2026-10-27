//go:build windows

package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	// Each launch signs in again with a fresh token, so the session only has to outlive one app run.
	sessionTTL  = "720h"
	maxLogBytes = 10 * 1024 * 1024
)

type serverConfig struct {
	executable    string
	port          int
	encryptionKey string
	paths         appPaths
}

type server struct {
	cmd       *exec.Cmd
	job       windows.Handle
	log       *os.File
	baseURL   string
	signInURL string
	exited    chan struct{}

	mu               sync.Mutex
	stopping         bool
	onUnexpectedExit func(code int)
}

func startServer(cfg serverConfig) (*server, error) {
	if _, err := os.Stat(cfg.executable); err != nil {
		return nil, fmt.Errorf("binário do servidor não encontrado em %s", cfg.executable)
	}

	token, err := randomHex(32)
	if err != nil {
		return nil, fmt.Errorf("falha ao gerar o token de acesso local: %w", err)
	}

	logFile, err := openLog(cfg.paths.serverLog())
	if err != nil {
		return nil, err
	}

	job, err := newKillOnCloseJob()
	if err != nil {
		logFile.Close()
		return nil, fmt.Errorf("falha ao criar o Job Object: %w", err)
	}

	addr := fmt.Sprintf("127.0.0.1:%d", cfg.port)
	env := os.Environ()
	env = setEnv(env, "PATH", withPostgresPath(os.Getenv("PATH")))
	env = setEnv(env, "DBCLIENT_ENCRYPTION_KEY", cfg.encryptionKey)
	env = setEnv(env, "DBCLIENT_AUTH_MODE", "local")
	env = setEnv(env, "DBCLIENT_LOCAL_TOKEN", token)
	env = setEnv(env, "DBCLIENT_SESSION_TTL", sessionTTL)
	env = setEnv(env, "DBCLIENT_ADDR", addr)
	env = setEnv(env, "DBCLIENT_DATA_DIR", cfg.paths.dataDir)
	env = setEnv(env, "DBCLIENT_DUMP_DIR", cfg.paths.dumpDir)

	cmd := exec.Command(cfg.executable)
	cmd.Env = env
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}

	if err := cmd.Start(); err != nil {
		windows.CloseHandle(job)
		logFile.Close()
		return nil, err
	}
	if err := assignToJob(job, cmd.Process.Pid); err != nil {
		_ = cmd.Process.Kill()
		windows.CloseHandle(job)
		logFile.Close()
		return nil, fmt.Errorf("falha ao associar o servidor ao Job Object: %w", err)
	}

	s := &server{
		cmd:       cmd,
		job:       job,
		log:       logFile,
		baseURL:   "http://" + addr,
		signInURL: "http://" + addr + "/api/auth/local?token=" + token,
		exited:    make(chan struct{}),
	}
	go s.wait()
	return s, nil
}

func (s *server) wait() {
	err := s.cmd.Wait()
	close(s.exited)

	s.mu.Lock()
	stopping, callback := s.stopping, s.onUnexpectedExit
	s.mu.Unlock()
	if stopping || callback == nil {
		return
	}

	code := -1
	var exitErr *exec.ExitError
	if err == nil {
		code = 0
	} else if errors.As(err, &exitErr) {
		code = exitErr.ExitCode()
	}
	callback(code)
}

func (s *server) OnUnexpectedExit(callback func(code int)) {
	s.mu.Lock()
	s.onUnexpectedExit = callback
	s.mu.Unlock()
}

func (s *server) WaitUntilHealthy(timeout time.Duration) error {
	client := &http.Client{Timeout: time.Second}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		select {
		case <-s.exited:
			return fmt.Errorf("o servidor encerrou durante a inicialização (código %d)", s.cmd.ProcessState.ExitCode())
		default:
		}
		if res, err := client.Get(s.baseURL + "/healthz"); err == nil {
			res.Body.Close()
			if res.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(200 * time.Millisecond)
	}
	return errors.New("o servidor não respondeu ao health check a tempo")
}

// Windows has no SIGTERM for a windowless child, so the job is closed and the server is terminated.
// SQLite in WAL mode recovers from this, and psql/pg_dump children die with it, rolling back their transaction.
func (s *server) Stop() {
	s.mu.Lock()
	s.stopping = true
	s.mu.Unlock()

	windows.CloseHandle(s.job)
	select {
	case <-s.exited:
	case <-time.After(5 * time.Second):
	}
	s.log.Close()
}

func newKillOnCloseJob() (windows.Handle, error) {
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return 0, err
	}
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{
			LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
		},
	}
	if _, err := windows.SetInformationJobObject(
		job,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	); err != nil {
		windows.CloseHandle(job)
		return 0, err
	}
	return job, nil
}

func assignToJob(job windows.Handle, pid int) error {
	process, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(pid))
	if err != nil {
		return err
	}
	defer windows.CloseHandle(process)
	return windows.AssignProcessToJobObject(job, process)
}

// The PostgreSQL installer does not add its bin directory to PATH, so pg_dump/psql would not be found.
func withPostgresPath(current string) string {
	dirs, _ := filepath.Glob(filepath.Join(os.Getenv("ProgramFiles"), "PostgreSQL", "*", "bin"))
	sort.Slice(dirs, func(i, j int) bool {
		return majorVersion(dirs[i]) > majorVersion(dirs[j])
	})

	var found []string
	for _, dir := range dirs {
		if _, err := os.Stat(filepath.Join(dir, "pg_dump.exe")); err == nil {
			found = append(found, dir)
		}
	}
	if len(found) == 0 {
		return current
	}
	return strings.Join(found, string(os.PathListSeparator)) + string(os.PathListSeparator) + current
}

func majorVersion(binDir string) float64 {
	version, _ := strconv.ParseFloat(filepath.Base(filepath.Dir(binDir)), 64)
	return version
}

// Windows environment variable names are case-insensitive ("Path" vs "PATH").
func setEnv(env []string, key, value string) []string {
	result := make([]string, 0, len(env)+1)
	for _, entry := range env {
		name, _, _ := strings.Cut(entry, "=")
		if !strings.EqualFold(name, key) {
			result = append(result, entry)
		}
	}
	return append(result, key+"="+value)
}

func openLog(path string) (*os.File, error) {
	if info, err := os.Stat(path); err == nil && info.Size() > maxLogBytes {
		_ = os.Remove(path + ".1")
		_ = os.Rename(path, path+".1")
	}
	return os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
}

func randomHex(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
