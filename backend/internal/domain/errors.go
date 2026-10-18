package domain

import "errors"

var (
	ErrNotFound         = errors.New("resource not found")
	ErrConflict         = errors.New("resource already exists")
	ErrValidation       = errors.New("validation error")
	ErrUnauthorized     = errors.New("unauthorized")
	ErrForbidden        = errors.New("forbidden")
	ErrPasswordRequired = errors.New("password change required")
	ErrFileTooLarge     = errors.New("file exceeds maximum allowed size")
)

type ValidationError struct {
	Message string
}

func (e ValidationError) Error() string {
	return e.Message
}

func (e ValidationError) Unwrap() error {
	return ErrValidation
}

func NewValidationError(message string) error {
	return ValidationError{Message: message}
}

type ConflictError struct {
	Message string
}

func (e ConflictError) Error() string {
	return e.Message
}

func (e ConflictError) Unwrap() error {
	return ErrConflict
}

func NewConflictError(message string) error {
	return ConflictError{Message: message}
}

type ForbiddenError struct {
	Message string
}

func (e ForbiddenError) Error() string {
	return e.Message
}

func (e ForbiddenError) Unwrap() error {
	return ErrForbidden
}

func NewForbiddenError(message string) error {
	return ForbiddenError{Message: message}
}
