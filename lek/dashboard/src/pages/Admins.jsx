import { useMemo, useState } from 'react'
import { Plus, X, KeyRound, Trash2 } from 'lucide-react'
import { useAsync, getAdmins, createAdmin, changeAdminPassword, deleteAdmin, getCurrentAdmin } from '../api'

const MIN_PASSWORD = 8

// --- Add admin --------------------------------------------------------------
function AddAdminModal({ open, onClose, onSubmit }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  if (!open) return null

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD
  const valid = username.trim() && password.length >= MIN_PASSWORD

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setSaving(true)
    try {
      await onSubmit({ username: username.trim(), password })
      onClose()
    } catch (e2) {
      setErr(e2.message || 'Could not create admin')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-surface p-7">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Add admin</h2>
            <p className="mt-0.5 text-sm text-muted">Create a new dashboard administrator.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
              placeholder="e.g. jane.doe"
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
              placeholder="At least 8 characters"
            />
            <p className={`mt-1.5 text-xs ${tooShort ? 'text-bad' : 'text-faint'}`}>
              Minimum {MIN_PASSWORD} characters.
            </p>
          </div>

          {err && <p className="text-sm font-medium text-bad">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-line-strong px-5 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !valid}
              className="rounded-full bg-forest px-5 py-2 text-sm font-semibold text-white transition hover:bg-forest-hover disabled:opacity-60"
            >
              {saving ? 'Adding…' : 'Add admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- Change password --------------------------------------------------------
function ChangePasswordModal({ admin, onClose, onSubmit }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  if (!admin) return null

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD
  const valid = password.length >= MIN_PASSWORD

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setSaving(true)
    try {
      await onSubmit(admin.id, password)
      onClose()
    } catch (e2) {
      setErr(e2.message || 'Could not change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-surface p-7">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Change password</h2>
            <p className="mt-0.5 text-sm text-muted">
              For <span className="font-medium text-ink-soft">{admin.username}</span>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
              placeholder="At least 8 characters"
            />
            <p className={`mt-1.5 text-xs ${tooShort ? 'text-bad' : 'text-faint'}`}>
              Minimum {MIN_PASSWORD} characters.
            </p>
          </div>

          {err && <p className="text-sm font-medium text-bad">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-line-strong px-5 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !valid}
              className="rounded-full bg-forest px-5 py-2 text-sm font-semibold text-white transition hover:bg-forest-hover disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- Delete confirm ---------------------------------------------------------
function DeleteAdminModal({ admin, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  if (!admin) return null

  async function confirm() {
    setErr('')
    setSaving(true)
    try {
      await onConfirm(admin.id)
      onClose()
    } catch (e2) {
      setErr(e2.message || 'Could not delete admin')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl bg-surface p-7">
        <h2 className="text-lg font-semibold text-ink">Remove admin?</h2>
        <p className="mt-1 text-sm text-muted">
          <span className="font-medium text-ink-soft">{admin.username}</span> will lose access to
          the dashboard. This cannot be undone.
        </p>

        {err && <p className="mt-4 text-sm font-medium text-bad">{err}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line-strong px-5 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving}
            className="rounded-full bg-bad px-5 py-2 text-sm font-semibold text-white transition hover:bg-bad/90 disabled:opacity-60"
          >
            {saving ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Admins() {
  const [modalOpen, setModalOpen] = useState(false)
  const [pwTarget, setPwTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [tick, setTick] = useState(0)

  const { data, loading, error } = useAsync(getAdmins, [tick])
  const admins = useMemo(() => data || [], [data])
  const me = getCurrentAdmin()
  const onlyOne = admins.length <= 1

  async function handleCreate(payload) {
    await createAdmin(payload)
    setTick((t) => t + 1)
  }
  async function handleChangePassword(id, password) {
    await changeAdminPassword(id, password)
    setTick((t) => t + 1)
  }
  async function handleDelete(id) {
    await deleteAdmin(id)
    setTick((t) => t + 1)
  }

  if (loading) return <p className="py-20 text-center text-muted">Loading admins…</p>
  if (error) return <p className="py-20 text-center text-bad">Could not load admins.</p>

  return (
    <div className="flex h-[calc(100vh-130px)] flex-col space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Admins</h1>
          <p className="mt-1 text-sm text-muted">Manage who can sign in to the dashboard.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-hover sm:self-auto"
        >
          <Plus size={16} strokeWidth={2} />
          Add admin
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface p-7">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-khaki text-left text-[13px] font-semibold text-ink-soft">
                <th className="rounded-l-xl px-6 py-3.5">Username</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="rounded-r-xl px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isSelf = me && Number(a.id) === Number(me.id)
                return (
                  <tr key={a.id} className="border-b border-line last:border-0 transition-colors hover:bg-canvas/60">
                    <td className="h-14 px-6 font-medium text-ink">
                      {a.username}
                      {isSelf && (
                        <span className="ml-2 rounded-full bg-mint px-2 py-0.5 text-[11px] font-medium text-forest">
                          You
                        </span>
                      )}
                    </td>
                    <td className="h-14 px-6 text-ink-soft capitalize">{a.role || '—'}</td>
                    <td className="tnum h-14 px-6 text-ink-soft">
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="h-14 px-6">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPwTarget(a)}
                          title="Change password"
                          className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
                        >
                          <KeyRound size={15} strokeWidth={1.8} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(a)}
                          disabled={isSelf || onlyOne}
                          title={
                            isSelf
                              ? 'You cannot delete your own account'
                              : onlyOne
                                ? 'Cannot delete the last remaining admin'
                                : 'Remove admin'
                          }
                          className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-bad disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
                        >
                          <Trash2 size={15} strokeWidth={1.8} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-faint">
        {admins.length} admin{admins.length === 1 ? '' : 's'}. The last remaining admin cannot be
        removed, and you cannot delete your own account.
      </p>

      <AddAdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
      <ChangePasswordModal
        admin={pwTarget}
        onClose={() => setPwTarget(null)}
        onSubmit={handleChangePassword}
      />
      <DeleteAdminModal
        admin={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
