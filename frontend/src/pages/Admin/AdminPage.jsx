import { useEffect, useMemo, useState } from 'react'
import { Plus, Save, ShieldCheck, UserPlus } from 'lucide-react'
import { createAdminUser, fetchAdminUsers, updateAdminUserAccess } from '../../lib/api'
import { Button, DataCard, PageHeader, PageShell, StatusBar, TableEmpty, TableWrap } from '../../components/ui'
import './AdminPage.css'

const emptyCreateForm = {
  username: '',
  password: '',
  is_superuser: false,
  tab_permissions: [],
}

function sortTabs(values) {
  return Array.from(new Set(values || [])).sort()
}

function buildDraft(user, assignableKeys) {
  return {
    is_superuser: Boolean(user.is_superuser),
    tab_permissions: sortTabs((user.tab_permissions || []).filter((tab) => assignableKeys.has(tab))),
  }
}

export default function AdminPage({ currentUser }) {
  const [state, setState] = useState({ tabs: [], users: [], isLoading: true, error: '', success: '' })
  const [drafts, setDrafts] = useState({})
  const [savingUserId, setSavingUserId] = useState(null)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      try {
        const data = await fetchAdminUsers()
        if (cancelled) {
          return
        }
        const tabs = data.tabs || []
        const assignableKeys = new Set(tabs.map((tab) => tab.key))
        const users = data.users || []
        setState({ tabs, users, isLoading: false, error: '', success: '' })
        setDrafts(Object.fromEntries(users.map((user) => [user.id, buildDraft(user, assignableKeys)])))
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            isLoading: false,
            error: error.response?.data?.detail || 'Не удалось загрузить пользователей',
          }))
        }
      }
    }

    loadUsers()
    return () => {
      cancelled = true
    }
  }, [])

  const assignableKeys = useMemo(() => new Set(state.tabs.map((tab) => tab.key)), [state.tabs])
  const usersById = useMemo(() => new Map(state.users.map((user) => [user.id, user])), [state.users])

  function updateCreateForm(field, value) {
    setCreateForm((current) => ({ ...current, [field]: value }))
  }

  function toggleCreateTab(tabKey) {
    setCreateForm((current) => {
      const selected = new Set(current.tab_permissions)
      if (selected.has(tabKey)) {
        selected.delete(tabKey)
      } else {
        selected.add(tabKey)
      }
      return { ...current, tab_permissions: sortTabs(Array.from(selected)) }
    })
  }

  function setDraftRole(userId, isSuperuser) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || { tab_permissions: [] }),
        is_superuser: isSuperuser,
      },
    }))
  }

  function toggleDraftTab(userId, tabKey) {
    setDrafts((current) => {
      const selected = new Set(current[userId]?.tab_permissions || [])
      if (selected.has(tabKey)) {
        selected.delete(tabKey)
      } else {
        selected.add(tabKey)
      }
      return {
        ...current,
        [userId]: {
          ...(current[userId] || { is_superuser: false }),
          tab_permissions: sortTabs(Array.from(selected)),
        },
      }
    })
  }

  async function submitCreateUser(event) {
    event.preventDefault()
    setIsCreating(true)
    setState((current) => ({ ...current, error: '', success: '' }))
    try {
      const payload = {
        username: createForm.username.trim(),
        password: createForm.password,
        is_superuser: createForm.is_superuser,
        tab_permissions: createForm.is_superuser ? [] : createForm.tab_permissions,
      }
      const createdUser = await createAdminUser(payload)
      setState((current) => ({
        ...current,
        users: [...current.users, createdUser].sort((a, b) => a.username.localeCompare(b.username) || a.id - b.id),
        success: 'Пользователь создан',
      }))
      setDrafts((current) => ({ ...current, [createdUser.id]: buildDraft(createdUser, assignableKeys) }))
      setCreateForm(emptyCreateForm)
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error.response?.data?.detail || 'Не удалось создать пользователя',
      }))
    } finally {
      setIsCreating(false)
    }
  }

  async function saveUser(userId) {
    const draft = drafts[userId] || { is_superuser: false, tab_permissions: [] }
    setSavingUserId(userId)
    setState((current) => ({ ...current, error: '', success: '' }))
    try {
      const updatedUser = await updateAdminUserAccess(userId, {
        is_superuser: draft.is_superuser,
        tab_permissions: draft.is_superuser ? [] : draft.tab_permissions,
      })
      setState((current) => ({
        ...current,
        users: current.users.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
        success: 'Доступ сохранён',
      }))
      setDrafts((current) => ({ ...current, [updatedUser.id]: buildDraft(updatedUser, assignableKeys) }))
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error.response?.data?.detail || 'Не удалось сохранить доступ',
      }))
    } finally {
      setSavingUserId(null)
    }
  }

  function hasChanges(userId) {
    const user = usersById.get(userId)
    const draft = drafts[userId]
    if (!user || !draft) {
      return false
    }
    const userDraft = buildDraft(user, assignableKeys)
    return (
      userDraft.is_superuser !== draft.is_superuser
      || userDraft.tab_permissions.join('|') !== sortTabs(draft.tab_permissions).join('|')
    )
  }

  return (
    <PageShell className="admin-page">
      <PageHeader title="Admin">
        <ShieldCheck size={22} strokeWidth={1.8} />
      </PageHeader>

      <DataCard className="admin-create-card">
        <form className="admin-create-form" onSubmit={submitCreateUser}>
          <div className="admin-create-form__title">
            <UserPlus size={18} />
            <span>Новый пользователь</span>
          </div>
          <label className="admin-field">
            <span>Логин</span>
            <input
              autoComplete="off"
              value={createForm.username}
              onChange={(event) => updateCreateForm('username', event.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Пароль</span>
            <input
              autoComplete="new-password"
              minLength={6}
              type="password"
              value={createForm.password}
              onChange={(event) => updateCreateForm('password', event.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Роль</span>
            <select
              value={createForm.is_superuser ? 'admin' : 'user'}
              onChange={(event) => updateCreateForm('is_superuser', event.target.value === 'admin')}
            >
              <option value="user">Пользователь</option>
              <option value="admin">Админ</option>
            </select>
          </label>
          {createForm.is_superuser ? (
            <div className="admin-create-form__all-access">Все вкладки</div>
          ) : (
            <div className="admin-create-form__tabs">
              {state.tabs.map((tab) => (
                <label key={tab.key} className="admin-users-table__tab">
                  <input
                    type="checkbox"
                    checked={createForm.tab_permissions.includes(tab.key)}
                    onChange={() => toggleCreateTab(tab.key)}
                  />
                  <span>{tab.label}</span>
                </label>
              ))}
            </div>
          )}
          <Button disabled={isCreating || state.isLoading} type="submit" variant="primary">
            <Plus size={16} />
            Создать
          </Button>
        </form>
      </DataCard>

      <DataCard>
        <StatusBar
          items={[{ label: 'Пользователи', value: state.users.length }]}
          success={state.success}
          error={state.error}
        />
        {state.isLoading ? (
          <TableEmpty>Загрузка...</TableEmpty>
        ) : state.users.length === 0 ? (
          <TableEmpty>Пользователей нет</TableEmpty>
        ) : (
          <TableWrap>
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Роль</th>
                  <th>Вкладки</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.users.map((user) => {
                  const draft = drafts[user.id] || buildDraft(user, assignableKeys)
                  const isCurrentUser = currentUser?.id === user.id
                  const roleLocked = isCurrentUser && user.is_superuser
                  return (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>
                        <select
                          className="admin-users-table__role"
                          disabled={roleLocked}
                          title={roleLocked ? 'Нельзя снять роль админа у себя' : undefined}
                          value={draft.is_superuser ? 'admin' : 'user'}
                          onChange={(event) => setDraftRole(user.id, event.target.value === 'admin')}
                        >
                          <option value="user">Пользователь</option>
                          <option value="admin">Админ</option>
                        </select>
                      </td>
                      <td>
                        {draft.is_superuser ? (
                          <span className="admin-users-table__all-access">Все вкладки</span>
                        ) : (
                          <div className="admin-users-table__tabs">
                            {state.tabs.map((tab) => (
                              <label key={tab.key} className="admin-users-table__tab">
                                <input
                                  type="checkbox"
                                  checked={(draft.tab_permissions || []).includes(tab.key)}
                                  onChange={() => toggleDraftTab(user.id, tab.key)}
                                />
                                <span>{tab.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="admin-users-table__actions">
                        <Button
                          className="admin-users-table__save"
                          disabled={savingUserId === user.id || !hasChanges(user.id)}
                          onClick={() => saveUser(user.id)}
                          variant="primary"
                        >
                          <Save size={16} />
                          Сохранить
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </DataCard>
    </PageShell>
  )
}
