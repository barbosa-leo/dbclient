import type { Role } from '@/services/auth';

export interface UserFormValues {
  username: string;
  password: string;
  role: Role;
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>;

export const MIN_PASSWORD_LENGTH = 8;

export function validateUser(values: UserFormValues, options: { isEditing: boolean }): UserFormErrors {
  const errors: UserFormErrors = {};

  if (!options.isEditing && !values.username.trim()) errors.username = 'Campo obrigatório';

  if (!options.isEditing && !values.password) {
    errors.password = 'Campo obrigatório';
  } else if (values.password && values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }

  return errors;
}
