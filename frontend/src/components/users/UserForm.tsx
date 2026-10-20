'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { validateUser } from '@/components/users/validation';
import type { UserFormErrors, UserFormValues } from '@/components/users/validation';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import type { Role, User } from '@/services/auth';
import type { Environment } from '@/services/connections';
import { createUser, updateUser } from '@/services/users';

interface UserFormProps {
  user: User | null;
  environments: Environment[];
  onSaved: () => void;
  onCancel: () => void;
}

const roles: readonly Role[] = ['viewer', 'operator', 'admin'];

export function UserForm({ user, environments, onSaved, onCancel }: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'viewer',
    environmentIds:
      user?.environmentIds ?? (environments.length === 1 ? environments.map((e) => e.id) : []),
  });
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = user !== null;

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
          environmentIds: values.role === 'admin' ? [] : values.environmentIds,
          ...(values.password ? { password: values.password } : {}),
        });
      } else {
        await createUser({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          role: values.role,
          environmentIds: values.role === 'admin' ? [] : values.environmentIds,
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
          value={values.role}
          onChange={(e) => setValues({ ...values, role: e.target.value as Role })}
        />

        {values.role === 'admin' ? (
          <div className="rounded-lg border border-line bg-muted/40 p-3 text-xs text-ink-muted sm:col-span-2">
            <span className="font-semibold text-ink">Acesso irrestrito:</span> Administradores possuem acesso automático a todos os ambientes e conexões da plataforma.
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ink-secondary">
                Ambientes permitidos <span className="text-danger">*</span>
              </label>
              {environments.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setValues({ ...values, environmentIds: environments.map((e) => e.id) })
                    }
                    className="cursor-pointer text-[11px] font-medium text-cta hover:underline"
                  >
                    Selecionar todos
                  </button>
                  <span className="text-ink-muted">·</span>
                  <button
                    type="button"
                    onClick={() => setValues({ ...values, environmentIds: [] })}
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
              <div className="flex flex-wrap gap-2 pt-1">
                {environments.map((env) => {
                  const selected = values.environmentIds?.includes(env.id);
                  return (
                    <button
                      key={env.id}
                      type="button"
                      onClick={() => {
                        const current = values.environmentIds ?? [];
                        const next = current.includes(env.id)
                          ? current.filter((id) => id !== env.id)
                          : [...current, env.id];
                        setValues({ ...values, environmentIds: next });
                      }}
                      className={`cursor-pointer inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        selected
                          ? 'border-cta bg-cta/10 text-ink shadow-sm'
                          : 'border-line bg-panel text-ink-muted hover:border-line-strong hover:text-ink'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                          selected ? 'border-cta bg-cta text-cta-fg' : 'border-line bg-subtle'
                        }`}
                      >
                        {selected && (
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                            className="h-3 w-3 stroke-current stroke-2"
                          >
                            <path
                              d="M3.5 8.5 6.5 11.5 12.5 4.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span>{env.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {errors.environmentIds && (
              <p role="alert" className="text-xs text-danger">
                {errors.environmentIds}
              </p>
            )}
          </div>
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
