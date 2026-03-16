# Outlook Bridge Setup

Command Center can use Outlook Desktop as the mail engine through a local Windows bridge.

## What this does

- Reads separate Outlook mailboxes directly from Outlook Desktop
- Lets Command Center and Q.U.B.E.:
  - list mailboxes
  - browse inbox/folders
  - search messages
  - read threads
  - mark read/unread
  - move/archive/delete
  - compose/reply/forward

## Requirements

- Windows
- Outlook Desktop installed and already signed into your accounts
- Outlook must be open while using the bridge
- PowerShell allowed to run local scripts

## Start the bridge

From the project root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\outlook-bridge.ps1
```

If it starts correctly, it listens on:

```text
http://127.0.0.1:45123
```

## Optional .env override

If you want a different port/url, add this to `.env`:

```env
VITE_OUTLOOK_BRIDGE_URL=http://127.0.0.1:45123
```

## Notes

- This is local-only; it is not exposed publicly.
- The web app will prefer the Outlook bridge when it is online.
- If the bridge is offline, the mail UI falls back to local mock data.
- Gmail / Microsoft provider auth can still exist, but Outlook bridge is the preferred path.
