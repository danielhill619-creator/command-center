import { useState } from 'react'
import FloatingChat from '../../widgets/floating-chat/FloatingChat'
import useWorkData from './useWorkData'
import { useArrowNav } from '../../shared/hooks/useArrowNav'
import styles from './WorkWorld.module.css'

// ── Kanban column config ────────────────────────────────────────────────────
const TASK_STATUSES = ['To Do', 'In Progress', 'Review', 'Done']
const PROJECT_STATUSES = ['Active', 'On Hold', 'Complete', 'Archived']
const PRIORITIES = ['High', 'Medium', 'Low']

// ── Small reusable modal ────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Section toggle tabs ─────────────────────────────────────────────────────
const SECTIONS = ['tasks', 'projects', 'invoices', 'clients', 'revenue']
const SECTION_LABELS = {
  tasks: 'TASKS',
  projects: 'PROJECTS',
  invoices: 'INVOICES',
  clients: 'CLIENTS',
  revenue: 'REVENUE',
}

export default function WorkWorld() {
  const {
    projects, tasks, clients, invoices, income,
    loading, error, reload,
    addProject, updateProjectStatus,
    addTask, updateTaskStatus,
    addClient,
    addInvoice, markInvoicePaid,
    addIncome,
    totalRevenue, pendingInvoicesTotal, paidInvoicesTotal,
  } = useWorkData()

  const [activeSection, setActiveSection] = useState('tasks')
  useArrowNav(SECTIONS, activeSection, setActiveSection)

  // Modal states
  const [showAddTask,    setShowAddTask]    = useState(false)
  const [showAddProject, setShowAddProject] = useState(false)
  const [showAddClient,  setShowAddClient]  = useState(false)
  const [showAddInvoice, setShowAddInvoice] = useState(false)
  const [showAddIncome,  setShowAddIncome]  = useState(false)

  // Form states
  const [taskForm,    setTaskForm]    = useState({ task: '', project: '', priority: 'Medium', dueDate: '', notes: '' })
  const [projectForm, setProjectForm] = useState({ name: '', client: '', dueDate: '', description: '' })
  const [clientForm,  setClientForm]  = useState({ name: '', email: '', phone: '', company: '' })
  const [invoiceForm, setInvoiceForm] = useState({ client: '', project: '', amount: '', notes: '' })
  const [incomeForm,  setIncomeForm]  = useState({ source: '', amount: '', category: 'Freelance', date: '' })

  const [saving, setSaving] = useState(false)

  // ── Submit handlers ───────────────────────────────────────────────────────

  async function submitTask(e) {
    e.preventDefault()
    if (!taskForm.task.trim()) return
    setSaving(true)
    await addTask(taskForm)
    setTaskForm({ task: '', project: '', priority: 'Medium', dueDate: '', notes: '' })
    setShowAddTask(false)
    setSaving(false)
  }

  async function submitProject(e) {
    e.preventDefault()
    if (!projectForm.name.trim()) return
    setSaving(true)
    await addProject(projectForm)
    setProjectForm({ name: '', client: '', dueDate: '', description: '' })
    setShowAddProject(false)
    setSaving(false)
  }

  async function submitClient(e) {
    e.preventDefault()
    if (!clientForm.name.trim()) return
    setSaving(true)
    await addClient(clientForm)
    setClientForm({ name: '', email: '', phone: '', company: '' })
    setShowAddClient(false)
    setSaving(false)
  }

  async function submitInvoice(e) {
    e.preventDefault()
    if (!invoiceForm.client.trim() || !invoiceForm.amount) return
    setSaving(true)
    await addInvoice(invoiceForm)
    setInvoiceForm({ client: '', project: '', amount: '', notes: '' })
    setShowAddInvoice(false)
    setSaving(false)
  }

  async function submitIncome(e) {
    e.preventDefault()
    if (!incomeForm.source.trim() || !incomeForm.amount) return
    setSaving(true)
    await addIncome(incomeForm)
    setIncomeForm({ source: '', amount: '', category: 'Freelance', date: '' })
    setShowAddIncome(false)
    setSaving(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const openTasks     = tasks.filter(t => t.status !== 'Done')
  const overdueTasks  = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done')
  const unpaidInvoices = invoices.filter(i => i.status !== 'Paid')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.worldBadge}>WORK</div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{openTasks.length}</span>
          <span className={styles.statLabel}>OPEN TASKS</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statValue}>{projects.filter(p => p.status === 'Active').length}</span>
          <span className={styles.statLabel}>ACTIVE PROJECTS</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${unpaidInvoices.length ? styles.statAlert : ''}`}>
            ${pendingInvoicesTotal.toLocaleString()}
          </span>
          <span className={styles.statLabel}>PENDING INVOICES</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={`${styles.statValue} ${styles.statGreen}`}>${paidInvoicesTotal.toLocaleString()}</span>
          <span className={styles.statLabel}>COLLECTED</span>
        </div>
        {overdueTasks.length > 0 && (
          <>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${styles.statAlert}`}>{overdueTasks.length}</span>
              <span className={styles.statLabel}>OVERDUE</span>
            </div>
          </>
        )}
        <button className={styles.reloadBtn} onClick={reload} title="Reload data">RELOAD</button>
      </div>

      {/* Section nav */}
      <nav className={styles.sectionNav}>
        {SECTIONS.map(s => (
          <button
            key={s}
            className={`${styles.navBtn} ${activeSection === s ? styles.navBtnActive : ''}`}
            onClick={() => setActiveSection(s)}
          >
            {SECTION_LABELS[s]}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className={styles.main}>
        {loading && <div className={styles.loadingMsg}>LOADING...</div>}
        {error   && <div className={styles.errorMsg}>{error}</div>}

        {/* ── TASKS (Kanban) ── */}
        {!loading && activeSection === 'tasks' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>TASK BOARD</span>
              <button className={styles.addBtn} onClick={() => setShowAddTask(true)}>+ ADD TASK</button>
            </div>
            <div className={styles.kanban}>
              {TASK_STATUSES.map(col => (
                <div key={col} className={styles.kanbanCol}>
                  <div className={styles.kanbanColHeader}>
                    <span className={styles.kanbanColLabel}>{col.toUpperCase()}</span>
                    <span className={styles.kanbanColCount}>
                      {tasks.filter(t => t.status === col).length}
                    </span>
                  </div>
                  <div className={styles.kanbanCards}>
                    {tasks.filter(t => t.status === col).map(t => (
                      <div key={t.id} className={styles.kanbanCard}>
                        <div className={styles.cardTitle}>{t.task}</div>
                        {t.project && <div className={styles.cardMeta}>{t.project}</div>}
                        <div className={styles.cardFooter}>
                          <span className={`${styles.priority} ${styles[`priority${t.priority}`]}`}>
                            {t.priority}
                          </span>
                          {t.dueDate && (
                            <span className={`${styles.dueDate} ${new Date(t.dueDate) < new Date() && col !== 'Done' ? styles.dueDateOverdue : ''}`}>
                              {t.dueDate}
                            </span>
                          )}
                        </div>
                        <div className={styles.cardActions}>
                          {TASK_STATUSES.filter(s => s !== col).map(s => (
                            <button
                              key={s}
                              className={styles.statusBtn}
                              onClick={() => updateTaskStatus(t.id, s)}
                            >
                              → {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {tasks.filter(t => t.status === col).length === 0 && (
                      <div className={styles.emptyCol}>—</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROJECTS ── */}
        {!loading && activeSection === 'projects' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>PROJECTS</span>
              <button className={styles.addBtn} onClick={() => setShowAddProject(true)}>+ ADD PROJECT</button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>PROJECT</th><th>CLIENT</th><th>STATUS</th><th>DUE</th><th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && (
                  <tr><td colSpan={5} className={styles.emptyRow}>No projects yet.</td></tr>
                )}
                {projects.map(p => (
                  <tr key={p.id}>
                    <td>
                      <span className={styles.rowMain}>{p.name}</span>
                      {p.description && <span className={styles.rowSub}>{p.description}</span>}
                    </td>
                    <td>{p.client}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`badge${p.status.replace(' ', '')}`]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className={p.dueDate && new Date(p.dueDate) < new Date() && p.status === 'Active' ? styles.dueDateOverdue : ''}>
                      {p.dueDate || '—'}
                    </td>
                    <td>
                      <select
                        className={styles.inlineSelect}
                        value={p.status}
                        onChange={e => updateProjectStatus(p.id, e.target.value)}
                      >
                        {PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── INVOICES ── */}
        {!loading && activeSection === 'invoices' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>INVOICES</span>
              <button className={styles.addBtn} onClick={() => setShowAddInvoice(true)}>+ NEW INVOICE</button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th><th>CLIENT</th><th>PROJECT</th><th>AMOUNT</th><th>STATUS</th><th>SENT</th><th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={7} className={styles.emptyRow}>No invoices yet.</td></tr>
                )}
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className={styles.invoiceId}>#{inv.id}</td>
                    <td>{inv.client}</td>
                    <td>{inv.project || '—'}</td>
                    <td className={styles.amount}>${parseFloat(inv.amount).toLocaleString()}</td>
                    <td>
                      <span className={`${styles.badge} ${inv.status === 'Paid' ? styles.badgePaid : styles.badgeUnpaid}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>{inv.dateSent || '—'}</td>
                    <td>
                      {inv.status !== 'Paid' && (
                        <button className={styles.payBtn} onClick={() => markInvoicePaid(inv.id)}>
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── CLIENTS ── */}
        {!loading && activeSection === 'clients' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>CLIENTS</span>
              <button className={styles.addBtn} onClick={() => setShowAddClient(true)}>+ ADD CLIENT</button>
            </div>
            <div className={styles.clientGrid}>
              {clients.length === 0 && <div className={styles.emptyMsg}>No clients yet.</div>}
              {clients.map(c => (
                <div key={c.id} className={styles.clientCard}>
                  <div className={styles.clientName}>{c.name}</div>
                  {c.company && <div className={styles.clientCompany}>{c.company}</div>}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className={styles.clientEmail}>{c.email}</a>
                  )}
                  {c.phone && <div className={styles.clientPhone}>{c.phone}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── REVENUE ── */}
        {!loading && activeSection === 'revenue' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>REVENUE</span>
              <button className={styles.addBtn} onClick={() => setShowAddIncome(true)}>+ LOG INCOME</button>
            </div>
            <div className={styles.revenueCards}>
              <div className={styles.revenueCard}>
                <div className={styles.revenueCardLabel}>TOTAL LOGGED</div>
                <div className={styles.revenueCardValue}>${totalRevenue.toLocaleString()}</div>
              </div>
              <div className={styles.revenueCard}>
                <div className={styles.revenueCardLabel}>INVOICED (PAID)</div>
                <div className={`${styles.revenueCardValue} ${styles.statGreen}`}>
                  ${paidInvoicesTotal.toLocaleString()}
                </div>
              </div>
              <div className={styles.revenueCard}>
                <div className={styles.revenueCardLabel}>OUTSTANDING</div>
                <div className={`${styles.revenueCardValue} ${pendingInvoicesTotal > 0 ? styles.statAlert : ''}`}>
                  ${pendingInvoicesTotal.toLocaleString()}
                </div>
              </div>
            </div>
            <table className={styles.table} style={{ marginTop: '24px' }}>
              <thead>
                <tr><th>DATE</th><th>SOURCE</th><th>AMOUNT</th><th>CATEGORY</th></tr>
              </thead>
              <tbody>
                {income.length === 0 && (
                  <tr><td colSpan={4} className={styles.emptyRow}>No income logged yet.</td></tr>
                )}
                {[...income].reverse().map((inc, i) => (
                  <tr key={i}>
                    <td>{inc.date}</td>
                    <td>{inc.source}</td>
                    <td className={styles.amount}>${parseFloat(inc.amount).toLocaleString()}</td>
                    <td>{inc.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>

      {/* ── MODALS ── */}

      {showAddTask && (
        <Modal title="ADD TASK" onClose={() => setShowAddTask(false)}>
          <form onSubmit={submitTask} className={styles.form}>
            <label>Task *
              <input value={taskForm.task} onChange={e => setTaskForm(f => ({ ...f, task: e.target.value }))} required />
            </label>
            <label>Project
              <select value={taskForm.project} onChange={e => setTaskForm(f => ({ ...f, project: e.target.value }))}>
                <option value="">— None —</option>
                {projects.map(p => <option key={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Priority
              <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label>Due Date
              <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
            </label>
            <label>Notes
              <input value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} />
            </label>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'SAVING...' : 'ADD TASK'}
            </button>
          </form>
        </Modal>
      )}

      {showAddProject && (
        <Modal title="ADD PROJECT" onClose={() => setShowAddProject(false)}>
          <form onSubmit={submitProject} className={styles.form}>
            <label>Project Name *
              <input value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} required />
            </label>
            <label>Client
              <input value={projectForm.client} onChange={e => setProjectForm(f => ({ ...f, client: e.target.value }))} />
            </label>
            <label>Due Date
              <input type="date" value={projectForm.dueDate} onChange={e => setProjectForm(f => ({ ...f, dueDate: e.target.value }))} />
            </label>
            <label>Description
              <input value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} />
            </label>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'SAVING...' : 'ADD PROJECT'}
            </button>
          </form>
        </Modal>
      )}

      {showAddClient && (
        <Modal title="ADD CLIENT" onClose={() => setShowAddClient(false)}>
          <form onSubmit={submitClient} className={styles.form}>
            <label>Name *
              <input value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} required />
            </label>
            <label>Company
              <input value={clientForm.company} onChange={e => setClientForm(f => ({ ...f, company: e.target.value }))} />
            </label>
            <label>Email
              <input type="email" value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} />
            </label>
            <label>Phone
              <input value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} />
            </label>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'SAVING...' : 'ADD CLIENT'}
            </button>
          </form>
        </Modal>
      )}

      {showAddInvoice && (
        <Modal title="NEW INVOICE" onClose={() => setShowAddInvoice(false)}>
          <form onSubmit={submitInvoice} className={styles.form}>
            <label>Client *
              <input value={invoiceForm.client} onChange={e => setInvoiceForm(f => ({ ...f, client: e.target.value }))} required />
            </label>
            <label>Project
              <select value={invoiceForm.project} onChange={e => setInvoiceForm(f => ({ ...f, project: e.target.value }))}>
                <option value="">— None —</option>
                {projects.map(p => <option key={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Amount ($) *
              <input type="number" min="0" step="0.01" value={invoiceForm.amount}
                onChange={e => setInvoiceForm(f => ({ ...f, amount: e.target.value }))} required />
            </label>
            <label>Notes
              <input value={invoiceForm.notes} onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))} />
            </label>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'SAVING...' : 'CREATE INVOICE'}
            </button>
          </form>
        </Modal>
      )}

      {showAddIncome && (
        <Modal title="LOG INCOME" onClose={() => setShowAddIncome(false)}>
          <form onSubmit={submitIncome} className={styles.form}>
            <label>Source *
              <input value={incomeForm.source} onChange={e => setIncomeForm(f => ({ ...f, source: e.target.value }))} required />
            </label>
            <label>Amount ($) *
              <input type="number" min="0" step="0.01" value={incomeForm.amount}
                onChange={e => setIncomeForm(f => ({ ...f, amount: e.target.value }))} required />
            </label>
            <label>Category
              <input value={incomeForm.category} onChange={e => setIncomeForm(f => ({ ...f, category: e.target.value }))} />
            </label>
            <label>Date
              <input type="date" value={incomeForm.date} onChange={e => setIncomeForm(f => ({ ...f, date: e.target.value }))} />
            </label>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'SAVING...' : 'LOG INCOME'}
            </button>
          </form>
        </Modal>
      )}

      <FloatingChat world="work" />
    </div>
  )
}
