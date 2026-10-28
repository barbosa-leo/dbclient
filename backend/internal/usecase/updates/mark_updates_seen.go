package updates

import (
	"context"
	"regexp"

	"dbclient/backend/internal/domain"
)

const maxVersionsPerRequest = 100

var versionPattern = regexp.MustCompile(`^\d+\.\d+\.\d+$`)

type MarkUpdatesSeen struct {
	views domain.UpdateViewRepository
}

func NewMarkUpdatesSeen(views domain.UpdateViewRepository) *MarkUpdatesSeen {
	return &MarkUpdatesSeen{views: views}
}

func (uc *MarkUpdatesSeen) Execute(ctx context.Context, userID int64, versions []string) error {
	if len(versions) == 0 || len(versions) > maxVersionsPerRequest {
		return domain.NewValidationError("Informe entre 1 e 100 versões")
	}
	for _, version := range versions {
		if !versionPattern.MatchString(version) {
			return domain.NewValidationError("Versão inválida: use o formato x.y.z")
		}
	}
	return uc.views.MarkSeen(ctx, userID, versions)
}
