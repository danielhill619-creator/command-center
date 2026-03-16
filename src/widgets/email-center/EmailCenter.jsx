import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useMailCenter from '../../shared/hooks/useMailCenter'
import { getProviderConfigStatus } from '../../integrations/email/emailAuth'
import styles from './EmailCenter.module.css'

const PROVIDER_CONFIG = getProviderConfigStatus()
const VIRTUAL_ROW_HEIGHT = 88
const OVERSCAN_ROWS = 6
const PANE_STORAGE_KEY = 'cc_mail_workspace_panes_v1'

const FOLDERS = ['Inbox', 'Drafts', 'Sent', 'Archive', 'Trash']
const FOLDER_ICONS = { Inbox: '📥', Drafts: '📝', Sent: '📤', Archive: '📦', Trash: '🗑' }

function senderInitials(from = '') {
  const name = from.replace(/<.*>/, '').trim()
  const parts = name.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '?'
}

function fmtTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 86400000 && d.getDate() === now.getDate())
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diff < 7 * 86400000)
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function FolderCount({ stats }) {
  if (!stats?.unread) return null
  return <span className={styles.folderCount}>{stats.unread}</span>
}

function MailComposer({ title, initial, onSubmit, onClose, busy }) {
  const [to, setTo]           = useState((initial.to ?? []).join(', '))
  const [cc, setCc]           = useState((initial.cc ?? []).join(', '))
  const [subject, setSubject] = useState(initial.subject ?? '')
  const [body, setBody]       = useState(initial.body ?? '')

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      to: to.split(',').map(v => v.trim()).filter(Boolean),
      cc: cc.split(',').map(v => v.trim()).filter(Boolean),
      subject,
      body,
    })
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.composer} onClick={e => e.stopPropagation()}>
        <div className={styles.composerHeader}>
          <span>{title}</span>
          <button className={styles.iconBtn} onClick={onClose}>✕</button>
        </div>
        <form className={styles.composerForm} onSubmit={handleSubmit}>
          <div className={styles.composerField}>
            <span>To</span>
            <input value={to} onChange={e => setTo(e.target.value)} required />
          </div>
          <div className={styles.composerField}>
            <span>Cc</span>
            <input value={cc} onChange={e => setCc(e.target.value)} />
          </div>
          <div className={styles.composerField}>
            <span>Subject</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} required />
          </div>
          <textarea className={styles.composerBody} value={body} onChange={e => setBody(e.target.value)} required />
          <div className={styles.composerActions}>
            <button className={styles.sendMailBtn} type="submit" disabled={busy}>Send</button>
            <button className={styles.discardBtn} type="button" onClick={onClose}>Discard</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EmailCenter({ mode = 'widget' }) {
  const mail = useMailCenter()
  const navigate = useNavigate()
  const [composeOpen,    setComposeOpen]    = useState(false)
  const [replyOpen,      setReplyOpen]      = useState(false)
  const [forwardOpen,    setForwardOpen]    = useState(false)
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [accountError,   setAccountError]   = useState('')
  const [expandedMessageId, setExpandedMessageId] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [showSnoozed, setShowSnoozed] = useState(false)
  const [listScrollTop, setListScrollTop] = useState(0)
  const [listHeight, setListHeight] = useState(700)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [paneSizes, setPaneSizes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PANE_STORAGE_KEY) || '{"nav":260,"list":420}')
    } catch {
      return { nav: 260, list: 420 }
    }
  })

  const activeFolders = useMemo(() => {
    if (mail.accountId === 'all') return FOLDERS
    return mail.folders[mail.accountId] ?? FOLDERS
  }, [mail.accountId, mail.folders])

  const staleAccounts = useMemo(
    () => mail.accounts.filter(account => account.authError),
    [mail.accounts]
  )
  const visibleMessages = useMemo(
    () => mail.messages.filter(message => {
      const snoozed = message.snoozedUntil && new Date(message.snoozedUntil).getTime() > nowTs
      if (!showSnoozed && snoozed) return false
      if (unreadOnly && message.read) return false
      return true
    }),
    [mail.messages, nowTs, showSnoozed, unreadOnly]
  )
  const selectedEntries = useMemo(
    () => visibleMessages.filter(message => selectedIds.includes(message.id)).map(message => ({ id: message.id, accountId: message.accountId })),
    [selectedIds, visibleMessages]
  )
  const unreadCount = useMemo(
    () => mail.messages.filter(message => !message.read).length,
    [mail.messages]
  )
  const followUpCount = useMemo(
    () => mail.messages.filter(message => message.followUpAt).length,
    [mail.messages]
  )
  const rowRefs = useRef(new Map())
  const messageListRef = useRef(null)
  const visibleMessagesRef = useRef([])

  const totalRows = visibleMessages.length
  const startIndex = Math.max(0, Math.floor(listScrollTop / VIRTUAL_ROW_HEIGHT) - OVERSCAN_ROWS)
  const endIndex = Math.min(totalRows, Math.ceil((listScrollTop + listHeight) / VIRTUAL_ROW_HEIGHT) + OVERSCAN_ROWS)
  const virtualRows = visibleMessages.slice(startIndex, endIndex)
  const topSpacer = startIndex * VIRTUAL_ROW_HEIGHT
  const bottomSpacer = Math.max(0, (totalRows - endIndex) * VIRTUAL_ROW_HEIGHT)

  useEffect(() => {
    visibleMessagesRef.current = visibleMessages
  }, [visibleMessages])

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 60000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!mail.selectedId) return
    const node = rowRefs.current.get(mail.selectedId)
    if (node) {
      node.scrollIntoView({ block: 'nearest' })
      return
    }
    const index = visibleMessagesRef.current.findIndex(message => message.id === mail.selectedId)
    if (index >= 0 && messageListRef.current) {
      messageListRef.current.scrollTop = Math.max(0, index * VIRTUAL_ROW_HEIGHT - VIRTUAL_ROW_HEIGHT)
    }
  }, [mail.selectedId])

  useEffect(() => {
    if (!messageListRef.current) return
    const element = messageListRef.current
    const syncHeight = () => setListHeight(element.clientHeight || 700)
    syncHeight()
    const observer = new ResizeObserver(syncHeight)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => mail.messages.some(message => message.id === id)))
  }, [mail.messages])

  useEffect(() => {
    localStorage.setItem(PANE_STORAGE_KEY, JSON.stringify(paneSizes))
  }, [paneSizes])

  useEffect(() => {
    const lastMessage = mail.selectedThread[mail.selectedThread.length - 1]
    setExpandedMessageId(lastMessage?.id || null)
  }, [mail.selectedThread])

  useEffect(() => {
    if (mode !== 'workspace') return

    function isTypingTarget(target) {
      const tag = target?.tagName?.toLowerCase()
      return tag === 'input' || tag === 'textarea' || target?.isContentEditable
    }

    function onKeyDown(e) {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'j') { e.preventDefault(); moveSelection(1); return }
      if (e.key === 'k') { e.preventDefault(); moveSelection(-1); return }
      if (e.key === 'c') { e.preventDefault(); setComposeOpen(true); return }
      if (e.key === 'e' && mail.selectedMessage) { e.preventDefault(); mail.archiveMessage(mail.selectedMessage.id, mail.selectedMessage.accountId); return }
      if ((e.key === 'Delete' || e.key === '#') && mail.selectedMessage) { e.preventDefault(); mail.deleteMessage(mail.selectedMessage.id, mail.selectedMessage.accountId); return }
      if (e.key === 'm' && mail.selectedMessage) { e.preventDefault(); mail.markRead(mail.selectedMessage.id, !mail.selectedMessage.read, mail.selectedMessage.accountId); return }
      if (e.key === 'r' && mail.selectedMessage) { e.preventDefault(); setReplyOpen(true); return }
      if (e.key === 'f' && mail.selectedMessage) { e.preventDefault(); setForwardOpen(true); return }
      if (e.key === 's' && mail.selectedMessage) { e.preventDefault(); mail.toggleStar(mail.selectedMessage.id, !mail.selectedMessage.starred, mail.selectedMessage.accountId); return }
      if (e.key === '!') { e.preventDefault(); if (mail.selectedMessage) mail.toggleImportant(mail.selectedMessage.id, !mail.selectedMessage.important, mail.selectedMessage.accountId); return }
      if (e.key === 'z' && mail.selectedMessage) { e.preventDefault(); mail.setSnooze(mail.selectedMessage.id, new Date(Date.now() + 86400000).toISOString()); return }
      if (e.key === 'y' && mail.selectedMessage) { e.preventDefault(); mail.setFollowUp(mail.selectedMessage.id, new Date(Date.now() + 86400000).toISOString()); return }
      if (e.key === 'x') {
        e.preventDefault()
        setSelectMode(value => !value)
        if (mail.selectedMessage) toggleSelection(mail.selectedMessage.id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mail, mode, visibleMessages])

  async function handleAccountAuth(account, e) {
    e.stopPropagation()
    setAccountError('')
    try {
      await mail.toggleAccountConnected(account.id, !account.connected)
    } catch (err) {
      setAccountError(err.message)
    }
  }

  async function moveSelection(direction) {
    if (!visibleMessages.length || selectMode) return
    const currentIndex = Math.max(0, visibleMessages.findIndex(message => message.id === mail.selectedId))
    const nextIndex = mail.selectedId == null
      ? 0
      : Math.min(visibleMessages.length - 1, Math.max(0, currentIndex + direction))
    const nextMessage = visibleMessages[nextIndex]
    if (nextMessage) await mail.selectMessage(nextMessage)
  }

  async function handleListKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      await moveSelection(1)
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      await moveSelection(-1)
    }
  }

  function startPaneDrag(type, e) {
    if (mode !== 'workspace') return
    const startX = e.clientX
    const origin = paneSizes[type]

    function handleMove(ev) {
      const next = origin + (ev.clientX - startX)
      setPaneSizes(prev => ({
        ...prev,
        [type]: type === 'nav'
          ? Math.min(340, Math.max(220, next))
          : Math.min(560, Math.max(320, next)),
      }))
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  function toggleSelection(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id])
  }

  function toggleSelectAllVisible() {
    if (selectedEntries.length === visibleMessages.length) {
      setSelectedIds([])
      return
    }
    setSelectedIds(visibleMessages.map(message => message.id))
  }

  async function handleBulkMarkRead(read) {
    if (!selectedEntries.length) return
    await mail.bulkMarkRead(selectedEntries.map(entry => ({ ...entry, read })))
    setSelectedIds([])
  }

  async function handleBulkArchive() {
    if (!selectedEntries.length) return
    await mail.bulkArchive(selectedEntries)
    setSelectedIds([])
  }

  async function handleBulkDelete() {
    if (!selectedEntries.length) return
    await mail.bulkDelete(selectedEntries)
    setSelectedIds([])
  }

  return (
    <div className={`${styles.shell} ${mode === 'workspace' ? styles.shellWorkspace : ''}`}>
      <div
        className={`${styles.layout} ${mode === 'workspace' ? styles.layoutWorkspace : ''} ${mail.selectedMessage ? styles.mobileReading : ''}`}
        style={mode === 'workspace' ? { gridTemplateColumns: `${paneSizes.nav}px 8px ${paneSizes.list}px 8px minmax(0, 1fr)` } : undefined}
      >

        {/* ── Left nav ── */}
        <nav className={styles.nav}>
          <button className={styles.newMailBtn} onClick={() => setComposeOpen(true)}>
            <span className={styles.newMailPlus}>+</span> New mail
          </button>

          {accountError && <div className={styles.navError}>{accountError}</div>}

          {/* All-accounts inbox shortcut */}
          <button
            className={`${styles.folderItem} ${mail.accountId === 'all' && mail.folder === 'Inbox' ? styles.folderItemActive : ''}`}
            onClick={() => { mail.setAccountId('all'); mail.setFolder('Inbox'); mail.setQuery('') }}
          >
            <span className={styles.folderIcon}>📥</span>
            <span className={styles.folderName}>All Inboxes</span>
            <FolderCount stats={mail.getFolderStats('all', 'Inbox')} />
          </button>

          {/* Per-account folder groups */}
          {mail.accounts.map(account => (
            <div key={account.id} className={styles.accountGroup}>
              <div className={styles.accountGroupHeader}>
                <span className={styles.accountDot} style={{ background: account.color }} />
                <span className={styles.accountGroupName} title={account.address}>{account.label}</span>
                {(account.authError || !account.connected) && (
                  <button className={styles.accountReconnect} onClick={e => handleAccountAuth(account, e)}>
                    Reconnect
                  </button>
                )}
                <span
                  className={styles.accountRemove}
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); mail.removeAccount(account.id) }}
                >✕</span>
              </div>
              {account.authError && <div className={styles.accountAuthError}>{account.authError}</div>}
              {FOLDERS.map(f => (
                <button
                  key={f}
                  className={`${styles.folderItem} ${styles.folderItemIndented} ${mail.accountId === account.id && mail.folder === f ? styles.folderItemActive : ''}`}
                  onClick={() => { mail.setAccountId(account.id); mail.setFolder(f); mail.setQuery('') }}
                >
                  <span className={styles.folderIcon}>{FOLDER_ICONS[f]}</span>
                  <span className={styles.folderName}>{f}</span>
                  <FolderCount stats={mail.getFolderStats(account.id, f)} />
                </button>
              ))}
            </div>
          ))}

          <button className={styles.addAcctBtn} onClick={() => setAddAccountOpen(true)}>
            + Add account
          </button>
        </nav>

        {mode === 'workspace' && <div className={styles.paneHandle} onPointerDown={e => startPaneDrag('nav', e)} />}

        {/* ── Message list ── */}
        <div className={styles.listCol}>
          <div className={styles.listHeader}>
            <div>
              <span className={styles.listTitle}>
                {mail.accountId === 'all' ? 'All Accounts' : (mail.accounts.find(a => a.id === mail.accountId)?.label ?? mail.accountId)}
                <span className={styles.listFolder}> / {mail.folder}</span>
              </span>
              <div className={styles.listMetaBar}>
                <span>{visibleMessages.length} shown</span>
                <span>{unreadCount} unread</span>
                <span>{followUpCount} follow-up</span>
              </div>
            </div>
            <div className={styles.listHeaderActions}>
              {mode !== 'workspace' && (
                <button className={styles.headerPillBtn} onClick={() => navigate('/mail')}>
                  Open Full Mail
                </button>
              )}
              <button className={`${styles.headerPillBtn} ${unreadOnly ? styles.headerPillBtnActive : ''}`} onClick={() => setUnreadOnly(value => !value)}>
                Unread only
              </button>
              <button className={`${styles.headerPillBtn} ${showSnoozed ? styles.headerPillBtnActive : ''}`} onClick={() => setShowSnoozed(value => !value)}>
                Snoozed
              </button>
              <button className={`${styles.headerPillBtn} ${selectMode ? styles.headerPillBtnActive : ''}`} onClick={() => { setSelectMode(value => !value); setSelectedIds([]) }}>
                Select
              </button>
              <button className={styles.refreshBtn} onClick={mail.refresh} disabled={mail.loading} title="Refresh">↻</button>
            </div>
          </div>

          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              value={mail.query}
              onChange={e => mail.setQuery(e.target.value)}
              placeholder="🔍  Search"
            />
          </div>

          {selectMode && (
            <div className={styles.bulkBar}>
              <label className={styles.bulkCheckAll}>
                <input type="checkbox" checked={visibleMessages.length > 0 && selectedEntries.length === visibleMessages.length} onChange={toggleSelectAllVisible} />
                <span>Select all visible</span>
              </label>
              <div className={styles.bulkMeta}>{selectedEntries.length} selected</div>
              <div className={styles.bulkActions}>
                <button className={styles.bulkBtn} onClick={() => handleBulkMarkRead(true)} disabled={!selectedEntries.length || mail.busy}>Read</button>
                <button className={styles.bulkBtn} onClick={() => handleBulkMarkRead(false)} disabled={!selectedEntries.length || mail.busy}>Unread</button>
                <button className={styles.bulkBtn} onClick={handleBulkArchive} disabled={!selectedEntries.length || mail.busy}>Archive</button>
                <button className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`} onClick={handleBulkDelete} disabled={!selectedEntries.length || mail.busy}>Delete</button>
              </div>
            </div>
          )}

          <div ref={messageListRef} className={styles.messageList} tabIndex={0} onKeyDown={handleListKeyDown} onScroll={e => setListScrollTop(e.currentTarget.scrollTop)}>
            {mail.loading && !mail.messages.length && (
              <div className={styles.listStatus}>Loading...</div>
            )}
            {mail.fetchError && (
              <div className={styles.listError}>⚠ {mail.fetchError}</div>
            )}
            {mail.actionError && !mail.fetchError && (
              <div className={styles.listError}>⚠ {mail.actionError}</div>
            )}
            {!mail.loading && !mail.fetchError && mail.messages.length === 0 && mail.accounts.length === 0 && (
              <div className={styles.listStatus}>No accounts — click <strong>+ Add account</strong></div>
            )}
            {!mail.loading && !mail.fetchError && mail.messages.length === 0 && staleAccounts.length > 0 && (
              <div className={styles.listError}>
                {staleAccounts.length === 1 ? 'A connected account session needs repair.' : 'Some connected account sessions need repair.'}
              </div>
            )}
            {!mail.loading && !mail.fetchError && mail.messages.length === 0 && mail.accounts.length > 0 && (
              <div className={styles.listStatus}>{staleAccounts.length > 0 ? 'Trying to restore account sessions. Use Reconnect only if this does not clear.' : 'No messages'}</div>
            )}
            {topSpacer > 0 && <div style={{ height: topSpacer }} />}
            {virtualRows.map(msg => (
              <button
                key={msg.id}
                ref={node => {
                  if (node) rowRefs.current.set(msg.id, node)
                  else rowRefs.current.delete(msg.id)
                }}
                className={`${styles.msgRow} ${mail.selectedId === msg.id ? styles.msgRowActive : ''} ${!msg.read ? styles.msgRowUnread : ''}`}
                onClick={() => selectMode ? toggleSelection(msg.id) : mail.selectMessage(msg)}
              >
                {selectMode && (
                  <label className={styles.msgCheckboxWrap} onClick={e => e.stopPropagation()}>
                    <input className={styles.msgCheckbox} type="checkbox" checked={selectedIds.includes(msg.id)} onChange={() => toggleSelection(msg.id)} />
                  </label>
                )}
                <div className={styles.msgAvatar} style={{ background: avatarColor(msg.from) }}>
                  {senderInitials(msg.from)}
                </div>
                <div className={styles.msgBody}>
                  <div className={styles.msgTop}>
                    <span className={styles.msgFrom}>{senderName(msg.from)}</span>
                    <div className={styles.msgMetaCluster}>
                      {msg.followUpAt && <span className={styles.msgFlagFollow}>Follow-up</span>}
                      {msg.snoozedUntil && <span className={styles.msgFlagSnooze}>Snoozed</span>}
                      {msg.important && <span className={styles.msgFlagImportant}>!</span>}
                      {msg.starred && <span className={styles.msgFlagStar}>★</span>}
                      <span className={styles.msgTime}>{fmtTime(msg.receivedAt)}</span>
                    </div>
                  </div>
                  <div className={styles.msgSubject}>{msg.subject}</div>
                  <div className={styles.msgPreview}>{msg.preview}</div>
                </div>
                {!msg.read && <span className={styles.unreadDot} />}
              </button>
            ))}
            {bottomSpacer > 0 && <div style={{ height: bottomSpacer }} />}
          </div>
        </div>

        {mode === 'workspace' && <div className={styles.paneHandle} onPointerDown={e => startPaneDrag('list', e)} />}

        {/* ── Reading pane ── */}
        <div className={styles.readPane}>
          <button className={styles.mobileBackBtn} onClick={() => { mail.setSelectedId && mail.selectMessage && mail.setAccountId(mail.accountId) ; window.dispatchEvent(new CustomEvent('cc:mail-back')) }}>
            ← Back to inbox
          </button>
          {!mail.selectedMessage && (
            <div className={styles.readEmpty}>Select a message to read</div>
          )}

          {mail.selectedMessage && (
            <>
              <div className={styles.readHeader}>
                <h2 className={styles.readSubject}>{mail.selectedMessage.subject}</h2>
                <div className={styles.readMeta}>
                  <div className={styles.readAvatar} style={{ background: avatarColor(mail.selectedMessage.from) }}>
                    {senderInitials(mail.selectedMessage.from)}
                  </div>
                  <div className={styles.readMetaText}>
                    <span className={styles.readFrom}>{mail.selectedMessage.from}</span>
                    <span className={styles.readTo}>To: {mail.selectedMessage.to?.join(', ')}</span>
                    <span className={styles.readDate}>{new Date(mail.selectedMessage.receivedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className={styles.readActions}>
                  <button className={styles.readActionBtn} onClick={() => setReplyOpen(true)}>↩ Reply</button>
                  <button className={styles.readActionBtn} onClick={() => setForwardOpen(true)}>↪ Forward</button>
                  <button className={styles.readActionBtn} onClick={() => mail.toggleStar(mail.selectedMessage.id, !mail.selectedMessage.starred, mail.selectedMessage.accountId)}>
                    {mail.selectedMessage.starred ? '★ Starred' : '☆ Star'}
                  </button>
                  <button className={styles.readActionBtn} onClick={() => mail.toggleImportant(mail.selectedMessage.id, !mail.selectedMessage.important, mail.selectedMessage.accountId)}>
                    {mail.selectedMessage.important ? 'Important' : 'Mark Important'}
                  </button>
                  <button className={styles.readActionBtn} onClick={() => mail.setSnooze(mail.selectedMessage.id, new Date(Date.now() + 86400000).toISOString())}>Snooze 1d</button>
                  <button className={styles.readActionBtn} onClick={() => mail.setFollowUp(mail.selectedMessage.id, new Date(Date.now() + 86400000).toISOString())}>Follow Up</button>
                  <button className={styles.readActionBtn} onClick={() => mail.archiveMessage(mail.selectedMessage.id, mail.selectedMessage.accountId)}>Archive</button>
                  <button className={`${styles.readActionBtn} ${styles.readActionDanger}`} onClick={() => mail.deleteMessage(mail.selectedMessage.id, mail.selectedMessage.accountId)}>Delete</button>
                  <button className={styles.readActionBtn} onClick={() => mail.markRead(mail.selectedMessage.id, !mail.selectedMessage.read, mail.selectedMessage.accountId)}>
                    {mail.selectedMessage.read ? 'Mark Unread' : 'Mark Read'}
                  </button>
                </div>
              </div>

              <div className={`${styles.readThread} ${mail.selectedThread.length <= 1 ? styles.readThreadSingle : ''}`}>
                {mail.selectedThread.map(msg => (
                  <article
                    key={msg.id}
                    className={`${styles.readMessage} ${expandedMessageId === msg.id ? styles.readMessageExpanded : ''}`}
                  >
                    <button
                      className={styles.readMessageToggle}
                      onClick={() => setExpandedMessageId(current => current === msg.id ? null : msg.id)}
                    >
                      <div className={styles.readMessageHeader}>
                        <div>
                          <span className={styles.readMessageFrom}>{msg.from}</span>
                          <div className={styles.readRecipientsRow}>
                            {msg.to?.length > 0 && <div className={styles.readRecipients}>To: {msg.to.join(', ')}</div>}
                            {msg.cc?.length > 0 && <div className={styles.readRecipients}>Cc: {msg.cc.join(', ')}</div>}
                          </div>
                        </div>
                        <div className={styles.readMessageMeta}>
                          <span className={styles.readMessageDate}>{new Date(msg.receivedAt).toLocaleString()}</span>
                          <span className={styles.readChevron}>{expandedMessageId === msg.id ? '−' : '+'}</span>
                        </div>
                      </div>
                    </button>
                    {expandedMessageId === msg.id && (
                      <div className={styles.readMessageContent}>
                        <iframe
                          className={styles.emailFrame}
                          srcDoc={msg.htmlBody || `<pre style="font-family:sans-serif;font-size:13px;color:#ddd;padding:16px;white-space:pre-wrap">${(msg.body||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>`}
                          sandbox="allow-same-origin allow-popups"
                          title={`email-${msg.id}`}
                        />
                        {msg.attachments?.length > 0 && (
                          <div className={styles.attachments}>
                            {msg.attachments.map(a => (
                              <span key={a.id} className={styles.attachment}>📎 {a.name} · {a.size}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {composeOpen && (
        <MailComposer
          title="New Message"
          initial={{ to: [], cc: [], subject: '', body: '' }}
          onClose={() => setComposeOpen(false)}
          busy={mail.busy}
          onSubmit={async p => {
            await mail.composeMessage({ accountId: mail.accountId === 'all' ? mail.accounts[0]?.id : mail.accountId, ...p })
            setComposeOpen(false)
          }}
        />
      )}

      {replyOpen && mail.selectedMessage && (
        <MailComposer
          title="Reply"
          initial={{
            to: [mail.selectedMessage.from],
            cc: [],
            subject: mail.selectedMessage.subject.startsWith('Re:') ? mail.selectedMessage.subject : `Re: ${mail.selectedMessage.subject}`,
            body: '',
          }}
          onClose={() => setReplyOpen(false)}
          busy={mail.busy}
          onSubmit={async p => {
            await mail.replyToMessage(mail.selectedMessage.id, { body: p.body })
            setReplyOpen(false)
          }}
        />
      )}

      {forwardOpen && mail.selectedMessage && (
        <MailComposer
          title="Forward"
          initial={{
            to: [],
            cc: [],
            subject: mail.selectedMessage.subject.startsWith('Fwd:') ? mail.selectedMessage.subject : `Fwd: ${mail.selectedMessage.subject}`,
            body: '',
          }}
          onClose={() => setForwardOpen(false)}
          busy={mail.busy}
          onSubmit={async p => {
            await mail.forwardMessage(mail.selectedMessage.id, { to: p.to, body: p.body })
            setForwardOpen(false)
          }}
        />
      )}

      {addAccountOpen && (
        <div className={styles.overlay} onClick={() => setAddAccountOpen(false)}>
          <div className={styles.addAcctModal} onClick={e => e.stopPropagation()}>
            <div className={styles.composerHeader}>
              <span>Add email account</span>
              <button className={styles.iconBtn} onClick={() => setAddAccountOpen(false)}>✕</button>
            </div>
            <div className={styles.addAcctBody}>
              <p className={styles.addAcctHint}>Sign in to connect your account.</p>
              {accountError && <div className={styles.navError}>{accountError}</div>}
              <button
                className={styles.providerBtn}
                style={{ '--c': '#ea4335' }}
                disabled={mail.busy || !PROVIDER_CONFIG.gmail}
                onClick={async () => {
                  setAccountError('')
                  try {
                    setAddAccountOpen(false)
                    await mail.addAccount('gmail')
                  } catch (e) {
                    setAddAccountOpen(true)
                    setAccountError(e.message)
                  }
                }}
              >
                <span className={styles.providerLogo} style={{ background: '#ea4335' }}>G</span>
                Google / Gmail
              </button>
              {!PROVIDER_CONFIG.microsoft ? (
                <div className={styles.providerDisabled}>
                  <span className={styles.providerLogo} style={{ background: '#0078d4' }}>M</span>
                  <div>
                    <strong>Microsoft / Exchange</strong>
                    <small>Requires VITE_MICROSOFT_CLIENT_ID in .env</small>
                  </div>
                </div>
              ) : (
                <button
                  className={styles.providerBtn}
                  style={{ '--c': '#0078d4' }}
                  disabled={mail.busy}
                  onClick={async () => {
                    setAccountError('')
                    try {
                      setAddAccountOpen(false)
                      await mail.addAccount('microsoft')
                    } catch (e) {
                      setAddAccountOpen(true)
                      setAccountError(e.message)
                    }
                  }}
                >
                  <span className={styles.providerLogo} style={{ background: '#0078d4' }}>M</span>
                  Microsoft / Exchange
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function senderName(from = '') {
  const match = from.match(/^([^<]+)</)
  return match ? match[1].trim() : from.split('@')[0]
}

const AVATAR_COLORS = ['#0078d4','#107c10','#d83b01','#8764b8','#038387','#c19c00','#e3008c']
function avatarColor(from = '') {
  let hash = 0
  for (let i = 0; i < from.length; i++) hash = from.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
