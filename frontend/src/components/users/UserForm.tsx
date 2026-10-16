'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { validateUser } from '@/components/users/validation';
import type { UserFormErrors, UserFormValues } from '@/components/users/validation';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import type { Role, User } from '@/services/auth';
import { createUser, updateUser } from '@/services/users';

interface UserFormProps {
  user: User | null;
  onSaved: () => void;
  onCancel: () => void;
}

const roles: readonly Role[] = ['operator', 'admin'];

export function UserForm({ user, onSaved, onCancel }: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>({
    username: user?.username ?? '',
    password: '',
    role: user?.role ?? 'operator',
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
          role: values.role,
          ...(values.password ? { password: values.password } : {}),
        });
      } else {
        await createUser({
          username: values.username.trim(),
          password: values.password,
          role: values.role,
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
      className="rounded-2xl border border-brand-300/60 bg-white/95 p-6 shadow-card backdrop-blur-sm"
    >
      <h2 className="mb-5 font-display text-base font-bold tracking-tight text-brand-900">
        {isEditing ? `Editar ${user.username}` : 'Novo usuário'}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {!isEditing && (
          <TextField
            label="Usuário"
            value={values.username}
            onChange={(e) => setValues({ ...values, username: e.target.value })}
            autoComplete="off"
            error={errors.username}
          />
        )}
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
      </div>
      {submitError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {submitError}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
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
