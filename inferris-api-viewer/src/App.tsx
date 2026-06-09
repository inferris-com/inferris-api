import {
  BadgePlus,
  ClipboardList,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type ApiSuccess<T> = { data: T }
type ApiListSuccess<T> = { data: T[]; meta: { count: number } }
type ApiError = { error?: { code: string; message: string; details?: unknown } }

type PlayerSummary = {
  id: string
  username: string
  flags: string
  orbs: string
  chatChannel: string
}

type PlayerDetails = PlayerSummary & {
  profile: PlayerProfile | null
  badges: number[]
  rankAssignments: RankAssignmentSummary[]
  createdAtMs: string
  lastSeenAtMs: string | null
  lastServerId: string | null
}

type PlayerProfile = {
  bio: string | null
  pronouns: string | null
  featuredBadgeId: number | null
  locale: string
  preferences: unknown
}

type BadgeAssignment = {
  playerId: string
  badgeId: number
  earnedAtMs: string
  source: string | null
}

type RankAssignmentSummary = {
  groupKey: string
  rankKey: string
}

type RankAssignment = RankAssignmentSummary & {
  playerId: string
  assignedAtMs: string
  assignedByActorId: string | null
  source: string | null
}

const emptyBadgeForm = { badgeId: '', source: '' }
const emptyRankForm = { groupKey: '', rankKey: '', source: '' }

function App() {
  const [players, setPlayers] = useState<PlayerSummary[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [player, setPlayer] = useState<PlayerDetails | null>(null)
  const [badges, setBadges] = useState<BadgeAssignment[]>([])
  const [query, setQuery] = useState('')
  const [badgeForm, setBadgeForm] = useState(emptyBadgeForm)
  const [rankForm, setRankForm] = useState(emptyRankForm)
  const [loading, setLoading] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')

  const selectedPlayer = useMemo(
    () => players.find((item) => item.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  )

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({ limit: '100', offset: '0' })
      if (query.trim()) params.set('username', query.trim())

      const response = await apiGet<ApiListSuccess<PlayerSummary>>(`/api/players?${params}`)
      setPlayers(response.data)

      if (response.data.length > 0 && !response.data.some((item) => item.id === selectedPlayerId)) {
        setSelectedPlayerId(response.data[0].id)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [query, selectedPlayerId])

  const loadSelectedPlayer = useCallback(async () => {
    if (!selectedPlayerId) {
      setPlayer(null)
      setBadges([])
      return
    }

    setLoading(true)
    setError('')

    try {
      const [playerResponse, badgesResponse] = await Promise.all([
        apiGet<ApiSuccess<PlayerDetails>>(`/api/players/${selectedPlayerId}`),
        apiGet<ApiListSuccess<BadgeAssignment>>(`/api/players/${selectedPlayerId}/badges`),
      ])

      setPlayer(playerResponse.data)
      setBadges(badgesResponse.data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [selectedPlayerId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPlayers()
  }, [loadPlayers])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSelectedPlayer()
  }, [loadSelectedPlayer])

  async function handleSearch(event: FormEvent) {
    event.preventDefault()
    await loadPlayers()
  }

  async function grantBadge(event: FormEvent) {
    event.preventDefault()
    if (!selectedPlayerId || !badgeForm.badgeId) return

    setBusyAction('badge')
    setError('')

    try {
      await apiSend<ApiSuccess<BadgeAssignment>>(`/api/players/${selectedPlayerId}/badges`, {
        method: 'POST',
        body: {
          badgeId: Number(badgeForm.badgeId),
          source: badgeForm.source.trim() || null,
        },
      })
      setBadgeForm(emptyBadgeForm)
      await loadSelectedPlayer()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyAction('')
    }
  }

  async function revokeBadge(badgeId: number) {
    if (!selectedPlayerId) return

    setBusyAction(`badge:${badgeId}`)
    setError('')

    try {
      await apiSend(`/api/players/${selectedPlayerId}/badges/${badgeId}`, { method: 'DELETE' })
      await loadSelectedPlayer()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyAction('')
    }
  }

  async function assignRank(event: FormEvent) {
    event.preventDefault()
    if (!selectedPlayerId || !rankForm.groupKey || !rankForm.rankKey) return

    setBusyAction('rank')
    setError('')

    try {
      await apiSend<ApiSuccess<RankAssignment>>(
        `/api/players/${selectedPlayerId}/ranks/${encodeURIComponent(
          rankForm.groupKey.trim(),
        )}/${encodeURIComponent(rankForm.rankKey.trim())}`,
        {
          method: 'PUT',
          body: {
            source: rankForm.source.trim() || null,
          },
        },
      )
      setRankForm(emptyRankForm)
      await loadSelectedPlayer()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyAction('')
    }
  }

  async function deleteRank(groupKey: string, rankKey: string) {
    if (!selectedPlayerId) return

    setBusyAction(`rank:${groupKey}:${rankKey}`)
    setError('')

    try {
      await apiSend(
        `/api/players/${selectedPlayerId}/ranks/${encodeURIComponent(groupKey)}/${encodeURIComponent(
          rankKey,
        )}`,
        { method: 'DELETE' },
      )
      await loadSelectedPlayer()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyAction('')
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>Inferris API Viewer</h1>
          <p>Players, profiles, badges, and ranks</p>
        </div>
        <button className="iconButton" type="button" onClick={loadSelectedPlayer} title="Refresh">
          <RefreshCw size={18} />
        </button>
      </header>

      {error ? <div className="errorBar">{error}</div> : null}

      <section className="workspace">
        <aside className="sidebar">
          <form className="searchRow" onSubmit={handleSearch}>
            <Search size={17} />
            <input
              aria-label="Search players"
              placeholder="Search username"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>

          <div className="listHeader">
            <span>Players</span>
            <small>{players.length}</small>
          </div>

          <div className="playerList">
            {players.map((item) => (
              <button
                className={item.id === selectedPlayerId ? 'playerItem active' : 'playerItem'}
                key={item.id}
                type="button"
                onClick={() => setSelectedPlayerId(item.id)}
              >
                <span>{item.username}</span>
                <small>{item.chatChannel}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="content">
          <div className="identityBand">
            <div className="avatar">
              <UserRound size={28} />
            </div>
            <div className="identityText">
              <h2>{player?.username ?? selectedPlayer?.username ?? 'No player selected'}</h2>
              <code>{player?.id ?? selectedPlayer?.id ?? 'select a player'}</code>
            </div>
            <div className="metricGrid">
              <Metric label="Orbs" value={player?.orbs ?? selectedPlayer?.orbs ?? '-'} />
              <Metric label="Flags" value={player?.flags ?? selectedPlayer?.flags ?? '-'} />
              <Metric label="Channel" value={player?.chatChannel ?? selectedPlayer?.chatChannel ?? '-'} />
            </div>
          </div>

          <div className="panelGrid">
            <section className="panel">
              <PanelTitle icon={<ClipboardList size={18} />} title="Profile" />
              <dl className="details">
                <DataRow label="Bio" value={player?.profile?.bio ?? '-'} />
                <DataRow label="Pronouns" value={player?.profile?.pronouns ?? '-'} />
                <DataRow label="Locale" value={player?.profile?.locale ?? '-'} />
                <DataRow label="Featured badge" value={formatMaybe(player?.profile?.featuredBadgeId)} />
                <DataRow label="Last seen" value={formatMs(player?.lastSeenAtMs)} />
              </dl>
            </section>

            <section className="panel">
              <PanelTitle icon={<BadgePlus size={18} />} title="Badges" />
              <form className="inlineForm" onSubmit={grantBadge}>
                <input
                  aria-label="Badge ID"
                  inputMode="numeric"
                  placeholder="Badge ID"
                  value={badgeForm.badgeId}
                  onChange={(event) => setBadgeForm({ ...badgeForm, badgeId: event.target.value })}
                />
                <input
                  aria-label="Badge source"
                  placeholder="Source"
                  value={badgeForm.source}
                  onChange={(event) => setBadgeForm({ ...badgeForm, source: event.target.value })}
                />
                <button type="submit" disabled={busyAction === 'badge'}>
                  <BadgePlus size={16} />
                  Grant
                </button>
              </form>

              <div className="assignmentList">
                {badges.map((badge) => (
                  <div className="assignmentRow" key={badge.badgeId}>
                    <div>
                      <strong>#{badge.badgeId}</strong>
                      <small>{badge.source ?? 'no source'} · {formatMs(badge.earnedAtMs)}</small>
                    </div>
                    <button
                      className="iconButton danger"
                      type="button"
                      title="Revoke badge"
                      disabled={busyAction === `badge:${badge.badgeId}`}
                      onClick={() => revokeBadge(badge.badgeId)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {badges.length === 0 ? <EmptyState text="No badge assignments" /> : null}
              </div>
            </section>

            <section className="panel wide">
              <PanelTitle icon={<Shield size={18} />} title="Ranks" />
              <form className="inlineForm rankForm" onSubmit={assignRank}>
                <input
                  aria-label="Group key"
                  placeholder="Group key"
                  value={rankForm.groupKey}
                  onChange={(event) => setRankForm({ ...rankForm, groupKey: event.target.value })}
                />
                <input
                  aria-label="Rank key"
                  placeholder="Rank key"
                  value={rankForm.rankKey}
                  onChange={(event) => setRankForm({ ...rankForm, rankKey: event.target.value })}
                />
                <input
                  aria-label="Rank source"
                  placeholder="Source"
                  value={rankForm.source}
                  onChange={(event) => setRankForm({ ...rankForm, source: event.target.value })}
                />
                <button type="submit" disabled={busyAction === 'rank'}>
                  <Shield size={16} />
                  Assign
                </button>
              </form>

              <div className="assignmentList rankList">
                {player?.rankAssignments.map((rank) => (
                  <div className="assignmentRow" key={`${rank.groupKey}:${rank.rankKey}`}>
                    <div>
                      <strong>{rank.rankKey}</strong>
                      <small>{rank.groupKey}</small>
                    </div>
                    <button
                      className="iconButton danger"
                      type="button"
                      title="Remove rank"
                      disabled={busyAction === `rank:${rank.groupKey}:${rank.rankKey}`}
                      onClick={() => deleteRank(rank.groupKey, rank.rankKey)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {player && player.rankAssignments.length === 0 ? (
                  <EmptyState text="No rank assignments" />
                ) : null}
              </div>
            </section>
          </div>

          {loading ? <div className="loadingOverlay">Loading</div> : null}
        </section>
      </section>
    </main>
  )
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="panelTitle">
      {icon}
      <h3>{title}</h3>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty">{text}</div>
}

function formatMaybe(value: number | string | null | undefined) {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

function formatMs(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

async function apiGet<T>(path: string): Promise<T> {
  return apiSend<T>(path, { method: 'GET' })
}

async function apiSend<T = void>(
  path: string,
  options: { method: string; body?: unknown },
): Promise<T> {
  const response = await fetch(path, {
    method: options.method,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError
    throw new Error(body.error?.message ?? `${response.status} ${response.statusText}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Request failed'
}

export default App
