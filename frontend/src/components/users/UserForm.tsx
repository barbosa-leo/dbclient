'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { validateUser } from '@/components/users/validation';
import type { UserFormErrors, UserFormValues } from '@/components/users/validation';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { accessLevelLabels, roleLabels } from '@/components/auth/access';
import type { AccessLevel, EnvironmentAccess, Role, User } from '@/services/auth';
import type { Environment } from '@/services/connections';
import { createUser, updateUser } from '@/services/users';

interface UserFormProps {
  user: User | null;
  environments: Environment[];
  onSaved: () => void;
  onCancel: () => void;
}

const roles: readonly Role[] = ['member', 'admin'];
const accessLevels: readonly AccessLevel[] = ['read', 'write'];

export function UserForm({ user, environments, onSaved, onCancel }: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'member',
    environments:
      user?.environments ??
      (environments.length === 1
        ? environments.map((env) => ({ environmentId: env.id, level: 'read' as const }))
        : []),
  });
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = user !== null;

  function levelOf(environmentId: number): AccessLevel | null {
    return values.environments.find((access) => access.environmentId === environmentId)?.level ?? null;
  }

  function setEnvironments(next: EnvironmentAccess[]) {
    setValues((current) => ({ ...current, environments: next }));
  }

  function toggleEnvironment(environmentId: number) {
    setEnvironments(
      levelOf(environmentId)
        ? values.environments.filter((access) => access.environmentId !== environmentId)
        : [...values.environments, { environmentId, level: 'read' }],
    );
  }

  function setLevel(environmentId: number, level: AccessLevel) {
    setEnvironments(
      values.environments.map((access) =>
        access.environmentId === environmentId ? { ...access, level } : access,
      ),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const validation = validateUser(values, { isEditing });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      if (user) {
        await updateUser(user.id, {
          name: values.name.trim(),
          email: values.email.trim(),
          role: values.role,
          environments: values.role === 'admin' ? [] : values.environments,
          ...(values.password ? { password: values.password } : {}),
        });
      } else {
        await createUser({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          role: values.role,
          environments: values.role === 'admin' ? [] : values.environments,
        });
      }
      onSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Falha ao salvar o usuário');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-xl border border-line bg-panel p-5 shadow-card"
    >
      <h2 className="mb-5 text-sm font-semibold tracking-tight text-ink">
        {isEditing ? `Editar ${user.name}` : 'Novo usuário'}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nome"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          autoComplete="off"
          error={errors.name}
        />
        <TextField
          label="E-mail"
          type="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          autoComplete="off"
          error={errors.email}
        />
        <TextField
          label={isEditing ? 'Nova senha (deixe em branco para manter)' : 'Senha'}
          type="password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          autoComplete="new-password"
          error={errors.password}
        />
        <SelectField
          label="Papel"
          options={roles}
          optionLabels={roleLabels}
          value={values.role}
          onChange={(e) => setValues({ ...values, role: e.target.value as Role })}
        />

        {values.role === 'admin' ? (
          <div className="rounded-lg border border-line bg-muted/40 p-3 text-xs text-ink-muted sm:col-span-2">
            <span className="font-semibold text-ink">Acesso irrestrito:</span> Administradores possuem acesso automático a todos os ambientes e conexões da plataforma.
          </div>
        ) : (
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <legend className="text-xs font-medium text-ink-secondary">
                Ambientes e permissões <span className="text-danger">*</span>
              </legend>
              {environments.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEnvironments(
                        environments.map((env) => ({
                          environmentId: env.id,
                          level: levelOf(env.id) ?? 'read',
                        })),
                      )
                    }
                    className="cursor-pointer text-[11px] font-medium text-cta hover:underline"
                  >
                    Selecionar todos
                  </button>
                  <span className="text-ink-muted">·</span>
                  <button
                    type="button"
                    onClick={() => setEnvironments([])}
                    className="cursor-pointer text-[11px] font-medium text-ink-muted hover:text-ink"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>

            {environments.length === 0 ? (
              <p className="text-xs text-ink-muted">Nenhum ambiente cadastrado na plataforma ainda.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {environments.map((env) => {
                  const level = levelOf(env.id);
                  return (
                    <li
                      key={env.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <label className="flex min-w-0 cursor-pointer items-center gap-2 text-xs font-medium text-ink">
                        <input
                          type="checkbox"
                          checked={level !== null}
                          onChange={() => toggleEnvironment(env.id)}
                          className="h-4 w-4 cursor-pointer accent-cta"
                        />
                        <span className="truncate">{env.name}</span>
                      </label>
                      <div
                        role="radiogroup"
                        aria-label={`Permissão em ${env.name}`}
                        className={`flex rounded-md bg-muted p-0.5 ${level === null ? 'opacity-40' : ''}`}
                      >
                        {accessLevels.map((option) => (
                          <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={level === option}
                            disabled={level === null}
                            onClick={() => setLevel(env.id, option)}
                            className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed ${
                              level === option
                                ? 'bg-panel text-ink shadow-card'
                                : 'text-ink-muted hover:text-ink'
                            }`}
                          >
                            {accessLevelLabels[option]}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-[11px] text-ink-muted">
              Leitura: explorar, consultar em transação somente leitura e exportar dumps. Leitura e
              escrita: também alterar dados e objetos, executar scripts e importar dumps.
            </p>

            {errors.environments && (
              <p role="alert" className="text-xs text-danger">
                {errors.environments}
              </p>
            )}
          </fieldset>
        )}
      </div>
      {submitError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {submitError}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
