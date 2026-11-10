import { useState } from 'react';
import { Trash2, Undo2 } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Button, Field, Label, Modal, Notice, PasswordInput, Segmented, formatDateTime } from './common';
import { deleteBusiness, cancelBusinessDeletion } from '../data/superadminApi';

// Eliminar negocio: ahora o en N días. El backend borra el negocio con todas
// sus subcolecciones, sus profesionales (usuarios, credenciales, sesiones),
// WhatsApp, secretos, conversaciones del asistente y la cuenta del admin.
// Programado: el negocio queda suspendido hasta la fecha y se puede cancelar.

const MAX_DAYS = 90;
const QUICK_DAYS = [3, 7, 30];

export default function DeleteBusinessPanel({ business, pushActivity, onDeleted }) {
  const deletion = business.deletion;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('later'); // 'now' | 'later'
  const [days, setDays] = useState('3');
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const nDays = Number(days);
  const daysOk = mode === 'now' || (Number.isInteger(nDays) && nDays >= 1 && nDays <= MAX_DAYS);
  const canSubmit = confirm.trim() === business.id && password.length > 0 && daysOk && !busy;

  function reset() {
    setOpen(false); setMode('later'); setDays('3'); setConfirm(''); setPassword(''); setShowPw(false); setError('');
  }

  async function handleConfirm() {
    setBusy(true);
    setError('');
    try {
      // Confirma que eres tú: Firebase vuelve a pedir la contraseña y el token
      // nuevo le dice al backend que fue hace instantes.
      const user = auth.currentUser;
      try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      } catch (err) {
        throw new Error(/wrong-password|invalid-credential|invalid-login/.test(err.code || '') ? 'Contraseña incorrecta.' : 'No se pudo verificar tu contraseña.');
      }
      await user.getIdToken(true);
      const finalDays = mode === 'now' ? 0 : nDays;
      const res = await deleteBusiness(business.id, { days: finalDays, confirm: confirm.trim() });
      if (res.deleted) {
        await pushActivity?.('Negocio eliminado', `${business.name} (${business.id}) y todos sus datos`, { negocioId: business.id });
        reset();
        onDeleted?.();
      } else {
        await pushActivity?.('Eliminación programada', `${business.name}: se elimina el ${formatDateTime(res.deletion.scheduledFor)}`, { negocioId: business.id });
        reset();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    setError('');
    try {
      await cancelBusinessDeletion(business.id);
      await pushActivity?.('Eliminación cancelada', business.name, { negocioId: business.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-bad/40 bg-surface p-4">
      <h3 className="text-sm font-semibold text-fg">Eliminar negocio</h3>
      {deletion?.scheduledFor ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Está suspendido y se elimina el <span className="text-fg">{formatDateTime(deletion.scheduledFor)}</span>, con todos sus datos.
            Si cancelas, vuelve al estado que tenía.
          </p>
          {error && <Notice tone="bad" className="mt-3">{error}</Notice>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button icon={Undo2} onClick={handleCancel} disabled={busy}>{busy ? 'Cancelando…' : 'Cancelar eliminación'}</Button>
            <Button variant="danger" icon={Trash2} onClick={() => { setMode('now'); setOpen(true); }} disabled={busy}>Eliminar ahora</Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Borra el negocio y todo lo suyo: citas, clientes, servicios, equipo, cajas, configuración, WhatsApp y la cuenta del administrador.
            No se puede deshacer.
          </p>
          <Button className="mt-3" variant="danger" icon={Trash2} onClick={() => setOpen(true)}>Eliminar negocio</Button>
        </>
      )}

      {open && (
        <Modal title={`Eliminar ${business.name}`} onClose={() => !busy && reset()}>
          <div className="space-y-4">
            <div>
              <Label>Cuándo</Label>
              <Segmented
                label="Cuándo eliminar"
                options={[{ value: 'now', label: 'Eliminar ahora' }, { value: 'later', label: 'En unos días' }]}
                value={mode}
                onChange={setMode}
              />
            </div>

            {mode === 'later' ? (
              <div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-28">
                    <Field label="Días" type="number" min="1" max={MAX_DAYS} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
                  </div>
                  {QUICK_DAYS.map((d) => (
                    <Button key={d} size="sm" variant={String(d) === days ? 'primary' : undefined} onClick={() => setDays(String(d))}>{d} días</Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-subtle">
                  {daysOk
                    ? `Se suspende ahora y se elimina en ${nDays} ${nDays === 1 ? 'día' : 'días'}. Hasta entonces puedes cancelarlo.`
                    : `Elige entre 1 y ${MAX_DAYS} días.`}
                </p>
              </div>
            ) : (
              <Notice tone="bad" title="Se borra todo al instante">No se puede deshacer.</Notice>
            )}

            <Field
              label={`Escribe ${business.id} para confirmar`}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <div>
              <Label htmlFor="delete-biz-password">Tu contraseña de Super Admin</Label>
              <PasswordInput
                id="delete-biz-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                visible={showPw}
                onToggleVisible={() => setShowPw((v) => !v)}
              />
            </div>

            {error && <Notice tone="bad">{error}</Notice>}
            <p className="text-xs text-subtle">Las fotos subidas a Cloudinary no se pueden borrar desde aquí y quedan sin uso.</p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={reset} disabled={busy}>Cancelar</Button>
            <Button variant="danger" icon={Trash2} onClick={handleConfirm} disabled={!canSubmit}>
              {busy ? 'Procesando…' : mode === 'now' ? 'Eliminar ahora' : `Programar en ${daysOk ? nDays : '…'} días`}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
