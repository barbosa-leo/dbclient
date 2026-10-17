package job

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"io"
	"sync"

	"dbclient/backend/internal/domain"
)

type entry struct {
	job    domain.Job
	cancel context.CancelFunc
}

type Manager struct {
	mu    sync.RWMutex
	jobs  map[string]*entry
	files domain.FileStore
}

func NewManager(files domain.FileStore) *Manager {
	return &Manager{
		jobs:  make(map[string]*entry),
		files: files,
	}
}

func (m *Manager) Start(
	kind domain.JobKind,
	fileName string,
	filePath string,
	worker func(ctx context.Context, setProgress func(int)) error,
) domain.Job {
	var rawID [8]byte
	_, _ = rand.Read(rawID[:])
	id := hex.EncodeToString(rawID[:])

	ctx, cancel := context.WithCancel(context.Background())
	initial := domain.Job{
		ID:       id,
		Kind:     kind,
		Status:   domain.JobStatusPending,
		Progress: 0,
		FileName: fileName,
		FilePath: filePath,
	}

	m.mu.Lock()
	m.jobs[id] = &entry{
		job:    initial,
		cancel: cancel,
	}
	m.mu.Unlock()

	go func() {
		defer cancel()

		m.update(id, func(j *domain.Job) {
			if j.Status == domain.JobStatusPending {
				j.Status = domain.JobStatusRunning
				j.Progress = 20
			}
		})

		err := worker(ctx, func(p int) {
			m.update(id, func(j *domain.Job) {
				if j.Status == domain.JobStatusRunning {
					j.Progress = p
				}
			})
		})

		m.update(id, func(j *domain.Job) {
			if j.Status == domain.JobStatusFailed {
				return
			}
			if err != nil {
				j.Status = domain.JobStatusFailed
				msg := err.Error()
				if ctx.Err() == context.Canceled {
					msg = "Cancelado pelo usuário"
				}
				j.Error = &msg
				return
			}
			j.Status = domain.JobStatusDone
			j.Progress = 100
		})
	}()

	return initial
}

func (m *Manager) Get(id string) (domain.Job, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	e, ok := m.jobs[id]
	if !ok {
		return domain.Job{}, domain.ErrNotFound
	}
	return e.job, nil
}

func (m *Manager) Cancel(id string) (domain.Job, error) {
	m.mu.Lock()
	e, ok := m.jobs[id]
	if !ok {
		m.mu.Unlock()
		return domain.Job{}, domain.ErrNotFound
	}

	if e.job.Status == domain.JobStatusPending || e.job.Status == domain.JobStatusRunning {
		msg := "Cancelado pelo usuário"
		e.job.Status = domain.JobStatusFailed
		e.job.Error = &msg
		if e.cancel != nil {
			e.cancel()
		}
	}
	snapshot := e.job
	m.mu.Unlock()

	return snapshot, nil
}

func (m *Manager) OpenDownload(id string) (domain.Job, io.ReadCloser, error) {
	job, err := m.Get(id)
	if err != nil {
		return domain.Job{}, nil, err
	}
	if job.Kind != domain.JobKindDumpExport || job.Status != domain.JobStatusDone || job.FilePath == "" {
		return domain.Job{}, nil, domain.NewConflictError("Dump ainda não está disponível para download")
	}

	reader, err := m.files.Open(job.FilePath)
	if err != nil {
		return domain.Job{}, nil, domain.ErrNotFound
	}
	return job, reader, nil
}

func (m *Manager) update(id string, fn func(*domain.Job)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if e, ok := m.jobs[id]; ok {
		fn(&e.job)
	}
}
