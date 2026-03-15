/**
 * Sheet Schemas
 *
 * Defines the structure of all 6 Command Center spreadsheets.
 * Each spreadsheet has named tabs, and each tab has header columns.
 *
 * This is the single source of truth for the data layer.
 * All worlds read/write using these tab names and column orders.
 */

export const SHEET_SCHEMAS = {

  // ── Work ────────────────────────────────────────────────────────────────────
  'Command Center — Work': {
    tabs: {
      Projects: [
        'ID', 'Project Name', 'Client', 'Status', 'Start Date', 'Due Date',
        'Description', 'Notes',
      ],
      Tasks: [
        'ID', 'Task', 'Project', 'Status', 'Priority', 'Due Date', 'Notes',
      ],
      Clients: [
        'ID', 'Name', 'Email', 'Phone', 'Company', 'Notes',
      ],
      Invoices: [
        'ID', 'Client', 'Project', 'Amount', 'Status', 'Date Sent',
        'Date Paid', 'Notes',
      ],
      Income: [
        'Date', 'Source', 'Amount', 'Category', 'Notes',
      ],
    },
  },

  // ── School ──────────────────────────────────────────────────────────────────
  'Command Center — School': {
    tabs: {
      Courses: [
        'ID', 'Course Name', 'Code', 'Credits', 'Semester', 'Grade',
        'Professor', 'Notes',
      ],
      Assignments: [
        'ID', 'Title', 'Course', 'Type', 'Status', 'Due Date',
        'Grade', 'Notes',
      ],
      Grades: [
        'Course', 'Assignment', 'Points Earned', 'Points Possible',
        'Percentage', 'Letter Grade', 'Date',
      ],
      'Degree Tracker': [
        'Requirement', 'Category', 'Credits Required', 'Credits Completed',
        'Status', 'Notes',
      ],
      'Study Schedule': [
        'Date', 'Course', 'Topic', 'Duration (min)', 'Completed', 'Notes',
      ],
    },
  },

  // ── Home ────────────────────────────────────────────────────────────────────
  'Command Center — Home': {
    tabs: {
      Bills: [
        'ID', 'Name', 'Category', 'Amount', 'Due Day', 'Auto Pay',
        'Account', 'Notes',
      ],
      Budget: [
        'Month', 'Category', 'Budgeted', 'Actual', 'Difference', 'Notes',
      ],
      'Shopping Lists': [
        'ID', 'Item', 'Category', 'Quantity', 'Store', 'Purchased', 'Date',
      ],
      Maintenance: [
        'ID', 'Task', 'Area', 'Frequency', 'Last Done', 'Next Due',
        'Cost', 'Notes',
      ],
      Documents: [
        'ID', 'Name', 'Category', 'Location', 'Expiry Date', 'Notes',
      ],
    },
  },

  // ── Fun ─────────────────────────────────────────────────────────────────────
  'Command Center — Fun': {
    tabs: {
      Hobbies: [
        'ID', 'Hobby', 'Category', 'Status', 'Last Activity', 'Notes',
      ],
      'Media Backlog': [
        'ID', 'Title', 'Type', 'Genre', 'Status', 'Rating', 'Date Added',
        'Date Completed', 'Notes',
      ],
      'Video Games': [
        'ID', 'Title', 'Platform', 'Status', 'Hours Played', 'Rating',
        'Notes',
      ],
      'Comics Collection': [
        'ID', 'Title', 'Issue', 'Publisher', 'Owned', 'Read', 'Condition',
        'Notes',
      ],
      'Social Plans': [
        'ID', 'Event', 'People', 'Date', 'Location', 'Status', 'Notes',
      ],
      'Bucket List': [
        'ID', 'Item', 'Category', 'Priority', 'Target Date', 'Completed',
        'Notes',
      ],
    },
  },

  // ── Spiritual ───────────────────────────────────────────────────────────────
  'Command Center — Spiritual': {
    tabs: {
      Habits: [
        'Date', 'Prayer', 'Bible Reading', 'Journaling', 'Church',
        'Fasting', 'Scripture Memory', 'Notes',
      ],
      'Prayer List': [
        'ID', 'Request', 'Category', 'Date Added', 'Status',
        'Date Answered', 'Notes',
      ],
      'Journal Index': [
        'Date', 'Title', 'Doc Link', 'Tags', 'Notes',
      ],
      Reflections: [
        'Date', 'Week', 'Wins', 'Struggles', 'Gratitude',
        'Scripture', 'Focus Next Week',
      ],
      Scripture: [
        'Reference', 'Text', 'Date Added', 'Memorized', 'Notes',
      ],
    },
  },

  // ── AI Memory ───────────────────────────────────────────────────────────────
  'Command Center — AI Memory': {
    tabs: {
      Context: [
        'Key', 'Value', 'Last Updated',
      ],
      'Conversation History': [
        'Timestamp', 'World', 'Role', 'Message',
      ],
      Preferences: [
        'Key', 'Value', 'Last Updated',
      ],
      'World Summary': [
        'World', 'Summary', 'Last Updated',
      ],
      'Action Log': [
        'Timestamp', 'World', 'Action', 'Details', 'Status',
      ],
    },
  },
}
