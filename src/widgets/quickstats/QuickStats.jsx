import { useState, useEffect } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'
import { readRange } from '../../integrations/google-sheets/sheetsService'
import styles from './QuickStats.module.css'

/**
 * Reads a count from a sheet tab.
 * Counts rows that have a value in column A (excluding the header row).
 */
async function countRows(spreadsheetId, tab) {
  if (!spreadsheetId) return null
  try {
    const rows = await readRange(spreadsheetId, `${tab}!A2:A1000`)
    return rows.filter(r => r[0]?.trim()).length
  } catch {
    return null
  }
}

export default function QuickStats() {
  const { sheetIds, sheetsReady } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!sheetsReady || !sheetIds) return

    async function load() {
      const [
        openTasks,
        openInvoices,
        dueAssignments,
        unpaidBills,
        prayerRequests,
      ] = await Promise.all([
        countRows(sheetIds['Command Center — Work'],     'Tasks'),
        countRows(sheetIds['Command Center — Work'],     'Invoices'),
        countRows(sheetIds['Command Center — School'],   'Assignments'),
        countRows(sheetIds['Command Center — Home'],     'Bills'),
        countRows(sheetIds['Command Center — Spiritual'],'Prayer List'),
      ])

      setStats({ openTasks, openInvoices, dueAssignments, unpaidBills, prayerRequests })
    }

    load()
  }, [sheetsReady, sheetIds])

  const items = [
    { world: 'WORK',     label: 'Tasks',       value: stats?.openTasks,       color: '#00c8ff' },
    { world: 'WORK',     label: 'Invoices',    value: stats?.openInvoices,    color: '#00c8ff' },
    { world: 'SCHOOL',   label: 'Assignments', value: stats?.dueAssignments,  color: '#ff2d8a' },
    { world: 'HOME',     label: 'Bills',       value: stats?.unpaidBills,     color: '#4caf50' },
    { world: 'SPIRITUAL',label: 'Prayers',     value: stats?.prayerRequests,  color: '#c9a84c' },
  ]

  return (
    <div className={styles.bar}>
      {items.map((item, i) => (
        <div key={i} className={styles.stat} style={{ '--stat-color': item.color }}>
          <span className={styles.world}>{item.world}</span>
          <span className={styles.value}>
            {stats === null ? '—' : (item.value ?? '—')}
          </span>
          <span className={styles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
