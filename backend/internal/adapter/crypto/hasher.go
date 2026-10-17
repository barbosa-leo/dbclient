package crypto

import (
	"dbclient/backend/internal/domain"

	"golang.org/x/crypto/bcrypt"
)

type BcryptHasher struct {
	cost int
}

func NewBcryptHasher() *BcryptHasher {
	return &BcryptHasher{cost: bcrypt.DefaultCost}
}

func (h *BcryptHasher) Hash(password string) (string, error) {
	encoded, err := bcrypt.GenerateFromPassword([]byte(password), h.cost)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func (h *BcryptHasher) Compare(hash, password string) error {
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return domain.ErrUnauthorized
	}
	return nil
}
