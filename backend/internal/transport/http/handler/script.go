package handler

import (
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strings"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/script"
)

type ScriptHandler struct {
	runScript   *script.RunScript
	maxFileSize int64
}

func NewScriptHandler(runScript *script.RunScript, maxFileSize int64) *ScriptHandler {
	return &ScriptHandler{
		runScript:   runScript,
		maxFileSize: maxFileSize,
	}
}

func (h *ScriptHandler) Run(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	filePart, fileName, err := nextUploadedFilePart(w, r, h.maxFileSize)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	defer filePart.Close()

	createdJob, err := h.runScript.Execute(r.Context(), script.RunScriptInput{
		ActorUsername: user.Username,
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

func nextUploadedFilePart(w http.ResponseWriter, r *http.Request, maxFileSize int64) (io.ReadCloser, string, error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxFileSize+1024*1024)

	contentType := r.Header.Get("Content-Type")
	mediaType, params, err := mime.ParseMediaType(contentType)
	if err != nil || !strings.HasPrefix(mediaType, "multipart/") {
		return nil, "", domain.NewValidationError("Envio deve ser multipart/form-data")
	}

	mr := multipart.NewReader(r.Body, params["boundary"])
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			if strings.Contains(err.Error(), "http: request body too large") {
				return nil, "", domain.ErrFileTooLarge
			}
			return nil, "", domain.NewValidationError("Falha ao ler arquivo enviado")
		}
		if part.FormName() == "file" && part.FileName() != "" {
			return part, part.FileName(), nil
		}
		_ = part.Close()
	}

	return nil, "", domain.NewValidationError("Arquivo .sql não informado")
}
