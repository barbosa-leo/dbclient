import { sslModes } from '@/services/connections';
import type { SslMode } from '@/services/connections';

export interface ConnectionFormValues {
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  sslMode: SslMode;
}

export type ConnectionFormErrors = Partial<Record<keyof ConnectionFormValues, string>>;

const REQUIRED = 'Campo obrigatório';

export function validateConnection(
  values: ConnectionFormValues,
  options: { passwordRequired: boolean },
): ConnectionFormErrors {
  const errors: ConnectionFormErrors = {};

  if (!values.name.trim()) errors.name = REQUIRED;
  if (!values.host.trim()) errors.host = REQUIRED;
  if (!values.database.trim()) errors.database = REQUIRED;
  if (!values.username.trim()) errors.username = REQUIRED;
  if (options.passwordRequired && !values.password) errors.password = REQUIRED;

  const port = Number(values.port);
  if (!values.port.trim()) {
    errors.port = REQUIRED;
  } else if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.port = 'Informe uma porta entre 1 e 65535';
  }

  if (!sslModes.includes(values.sslMode)) errors.sslMode = 'Modo SSL inválido';

  return errors;
}
