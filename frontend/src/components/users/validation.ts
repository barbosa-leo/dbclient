import type { Role } from '@/services/auth';

export interface UserFormValues {
  name: string;
  email: string;
  password: string;
  role: Role;
  environmentIds?: number[];
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>;

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUser(values: UserFormValues, options: { isEditing: boolean }): UserFormErrors {
  const errors: UserFormErrors = {};

  if (!values.name.trim()) {
    errors.name = 'Campo obrigatório';
  }

  const trimmedEmail = values.email.trim();
  if (!trimmedEmail) {
    errors.email = 'Campo obrigatório';
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = 'E-mail inválido';
  }

  if (!options.isEditing && !values.password) {
    errors.password = 'Campo obrigatório';
  } else if (values.password && values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }

  if (values.role !== 'admin' && (!values.environmentIds || values.environmentIds.length === 0)) {
    errors.environmentIds = 'Selecione ao menos um ambiente';
  }

  return errors;
}
