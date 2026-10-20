package handler

import (
	"fmt"
	"io"
	"net/http"

	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/dump"
	"dbclient/backend/internal/usecase/job"
)

type DumpHandler struct {
	exportDump  *dump.ExportDump
	importDump  *dump.ImportDump
	jobs        *job.Manager
	maxFileSize maxFileSizeProvider
}

func NewDumpHandler(
	exportDump *dump.ExportDump,
	importDump *dump.ImportDump,
	jobs *job.Manager,
	maxFileSize maxFileSizeProvider,
) *DumpHandler {
	return &DumpHandler{
		exportDump:  exportDump,
		importDump:  importDump,
		jobs:        jobs,
		maxFileSize: maxFileSize,
	}
}

func (h *DumpHandler) Export(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	createdJob, err := h.exportDump.Execute(r.Context(), user.ID, user.Email, connID)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, createdJob)
}

func (h *DumpHandler) ListUserDumps(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	dumps := h.jobs.ListUserDumps(user.ID)
	writeJSON(w, http.StatusOK, dumps)
}

func (h *DumpHandler) DeleteDump(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	id := r.PathValue("id")
	if err := h.jobs.DeleteDump(id, user.ID); err != nil {
		writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *DumpHandler) Import(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	maxFileSize, err := h.maxFileSize.MaxFileSize(r.Context())
	if err != nil {
		writeDomainError(w, err)
		return
	}

	filePart, fileName, err := nextUploadedFilePart(w, r, maxFileSize)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	defer filePart.Close()

	createdJob, err := h.importDump.Execute(r.Context(), dump.ImportDumpInput{
		ActorUsername: user.Email,
		ConnectionID:  connID,
		FileName:      fileName,
		Content:       filePart,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, createdJob)
}

func (h *DumpHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	found, err := h.jobs.Get(id)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, found)
}

func (h *DumpHandler) CancelJob(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	canceled, err := h.jobs.Cancel(id)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, canceled)
}

func (h *DumpHandler) DownloadJob(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	found, reader, err := h.jobs.OpenDownload(id)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	defer reader.Close()

	w.Header().Set("Content-Type", "application/sql; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, found.FileName))
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, reader)
}
