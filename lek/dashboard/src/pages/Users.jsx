import { useMemo, useState } from 'react'
import { Search, Plus, X, Pencil, Trash2 } from 'lucide-react'
import { StatusBadge } from '../components/Badge'
import { useAsync, getUsers, getCounties, createUser, updateUser, deleteUser } from '../api'

function AddUserModal({ open, onClose, counties, onSubmit }) {
  const [phone, setPhone] = useState('+211 9')
  const [countyId, setCountyId] = useState('')
  const [lang, setLang] = useState('en')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setSaving(true)
    try {
      await onSubmit({
        phone_number: phone.replace(/\s+/g, ''),
        county_id: Number(countyId || counties[0]?.id),
        language_preference: lang,
      })
      onClose()
    } catch (e2) {
      setErr(e2.message || 'Could not add user')
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
            <h2 className="text-lg font-semibold text-ink">Add user</h2>
            <p className="mt-0.5 text-sm text-muted">Register a new SMS subscriber.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* Registers a real subscriber via POST /api/users. */}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">Phone number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
              placeholder="+211 9XX XXX XXX"
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">State</label>
            <select
              value={countyId}
              onChange={(e) => setCountyId(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
            >
              {counties.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">Language</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
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
              disabled={saving}
              className="rounded-full bg-forest px-5 py-2 text-sm font-semibold text-white transition hover:bg-forest-hover disabled:opacity-60"
            >
              {saving ? 'Adding…' : 'Add user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit an existing subscriber's county, language and status (PATCH /api/users/:id).
// Phone number is shown read-only — the backend keys users by phone. The parent
// remounts this via key={user.id}, so state initialises straight from props.
function EditUserModal({ user, onClose, counties, onSubmit }) {
  const [countyId, setCountyId] = useState(String(user.countyId ?? ''))
  const [lang, setLang] = useState(user.language || 'en')
  const [status, setStatus] = useState(user.status || 'active')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setSaving(true)
    try {
      await onSubmit(user.id, {
        county_id: Number(countyId),
        language_preference: lang,
        status,
      })
      onClose()
    } catch (e2) {
      setErr(e2.message || 'Could not update user')
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
            <h2 className="text-lg font-semibold text-ink">Edit user</h2>
            <p className="mt-0.5 text-sm text-muted tnum">{user.phone}</p>
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
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">State</label>
            <select
              value={countyId}
              onChange={(e) => setCountyId(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
            >
              {counties.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">Language</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
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
              disabled={saving}
              className="rounded-full bg-forest px-5 py-2 text-sm font-semibold text-white transition hover:bg-forest-hover disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Confirm before removing a subscriber (DELETE /api/users/:id).
function DeleteUserModal({ user, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  if (!user) return null

  async function confirm() {
    setErr('')
    setSaving(true)
    try {
      await onConfirm(user.id)
      onClose()
    } catch (e2) {
      setErr(e2.message || 'Could not delete user')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl bg-surface p-7">
        <h2 className="text-lg font-semibold text-ink">Remove user?</h2>
        <p className="mt-1 text-sm text-muted">
          <span className="tnum font-medium text-ink-soft">{user.phone}</span> will stop receiving
          SMS price warnings. This cannot be undone.
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

export default function Users() {
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [tick, setTick] = useState(0)

  const { data: usersData, loading, error } = useAsync(getUsers, [tick])
  const { data: countiesData } = useAsync(getCounties)
  const users = useMemo(() => usersData || [], [usersData])
  const counties = countiesData || []

  async function handleRegister(payload) {
    await createUser(payload)
    setTick((t) => t + 1)
  }

  async function handleUpdate(id, payload) {
    await updateUser(id, payload)
    setTick((t) => t + 1)
  }

  async function handleDelete(id) {
    await deleteUser(id)
    setTick((t) => t + 1)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) => (u.county || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q),
    )
  }, [query, users])

  if (loading) return <p className="py-20 text-center text-muted">Loading users…</p>
  if (error) return <p className="py-20 text-center text-bad">Could not load users.</p>

  return (
    <div className="flex h-[calc(100vh-130px)] flex-col space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Users</h1>
          <p className="mt-1 text-sm text-muted">Citizens subscribed to receive SMS price warnings.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-hover sm:self-auto"
        >
          <Plus size={16} strokeWidth={2} />
          Add user
        </button>
      </header>

      <div className="relative max-w-xs">
        <Search
          size={15}
          strokeWidth={1.8}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search state or phone…"
          className="w-full rounded-full border border-line-strong bg-surface py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface p-7">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-khaki text-left text-[13px] font-semibold text-ink-soft">
                <th className="rounded-l-xl px-6 py-3.5">Phone Number</th>
                <th className="px-6 py-3.5">State</th>
                <th className="px-6 py-3.5">Language</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Registered</th>
                <th className="rounded-r-xl px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0 transition-colors hover:bg-canvas/60">
                  <td className="tnum h-14 px-6 font-medium text-ink">{u.phone}</td>
                  <td className="h-14 px-6 text-ink-soft">{u.county}</td>
                  <td className="h-14 px-6 text-ink-soft">{u.language}</td>
                  <td className="h-14 px-6">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="tnum h-14 px-6 text-ink-soft">
                    {u.registeredAt ? new Date(u.registeredAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="h-14 px-6">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditUser(u)}
                        title="Edit user"
                        className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
                      >
                        <Pencil size={15} strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        title="Remove user"
                        className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-bad"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    No users match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-faint">
        Showing {filtered.length} of {users.length} users.
      </p>

      <AddUserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        counties={counties}
        onSubmit={handleRegister}
      />
      {editUser && (
        <EditUserModal
          key={editUser.id}
          user={editUser}
          onClose={() => setEditUser(null)}
          counties={counties}
          onSubmit={handleUpdate}
        />
      )}
      <DeleteUserModal
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
