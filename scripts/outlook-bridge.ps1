$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Web

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:45123/')

function Write-JsonResponse {
  param(
    [Parameter(Mandatory=$true)] $Context,
    [Parameter(Mandatory=$true)] $Data,
    [int] $StatusCode = 200
  )

  $json = $Data | ConvertTo-Json -Depth 10
  $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = 'application/json; charset=utf-8'
  $Context.Response.ContentLength64 = $buffer.Length
  $Context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
  $Context.Response.OutputStream.Close()
}

function Read-JsonBody {
  param([Parameter(Mandatory=$true)] $Request)
  $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
  $body = $reader.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($body)) { return @{} }
  return $body | ConvertFrom-Json
}

function Get-OutlookNamespace {
  $outlook = New-Object -ComObject Outlook.Application
  return $outlook.GetNameSpace('MAPI')
}

function Normalize-MailItem {
  param($Item, [string] $AccountId, [string] $FolderName)

  $to = @()
  if ($Item.To) { $to = @($Item.To) }
  $cc = @()
  if ($Item.CC) { $cc = @($Item.CC) }

  return [ordered]@{
    id = [string]$Item.EntryID
    accountId = $AccountId
    folder = $FolderName
    threadId = [string]$Item.ConversationID
    subject = if ($Item.Subject) { [string]$Item.Subject } else { '(no subject)' }
    preview = if ($Item.Body) { ([string]$Item.Body).Substring(0, [Math]::Min(140, ([string]$Item.Body).Length)) } else { '' }
    from = if ($Item.SenderName -or $Item.SenderEmailAddress) { "$($Item.SenderName) <$($Item.SenderEmailAddress)>" } else { '' }
    to = $to
    cc = $cc
    body = if ($Item.Body) { [string]$Item.Body } else { '' }
    receivedAt = if ($Item.ReceivedTime) { ([datetime]$Item.ReceivedTime).ToString('o') } else { (Get-Date).ToString('o') }
    read = -not [bool]$Item.UnRead
    starred = [bool]$Item.FlagRequest
    hasAttachments = ([int]$Item.Attachments.Count -gt 0)
    attachments = @($Item.Attachments | ForEach-Object {
      [ordered]@{ id = [string]$_.Index; name = [string]$_.FileName; size = "$( [Math]::Round($_.Size / 1024, 1) ) KB" }
    })
    live = $true
  }
}

function Get-Accounts {
  $ns = Get-OutlookNamespace
  $accounts = @()
  foreach ($store in $ns.Stores) {
    try {
      $accounts += [ordered]@{
        id = [string]$store.StoreID
        provider = 'outlook'
        label = [string]$store.DisplayName
        address = [string]$store.DisplayName
        connected = $true
        color = '#0078d4'
        providerStatus = [ordered]@{ live = $true; reason = 'Outlook bridge connected' }
      }
    } catch {}
  }
  return $accounts
}

function Get-FolderByName {
  param($RootFolder, [string] $FolderName)

  if ($FolderName -eq 'Inbox')   { return $RootFolder.Folders.Item('Inbox') }
  if ($FolderName -eq 'Sent')    { return $RootFolder.Folders.Item('Sent Items') }
  if ($FolderName -eq 'Drafts')  { return $RootFolder.Folders.Item('Drafts') }
  if ($FolderName -eq 'Archive') { return $RootFolder.Folders.Item('Archive') }
  if ($FolderName -eq 'Trash')   { return $RootFolder.Folders.Item('Deleted Items') }
  return $RootFolder.Folders.Item($FolderName)
}

function Get-Messages {
  param([string] $AccountId, [string] $FolderName, [string] $Query)

  $ns = Get-OutlookNamespace
  $result = @()
  foreach ($store in $ns.Stores) {
    if ($AccountId -ne 'all' -and [string]$store.StoreID -ne $AccountId) { continue }
    try {
      $folder = Get-FolderByName -RootFolder $store.GetRootFolder() -FolderName $FolderName
      if (-not $folder) { continue }
      $items = $folder.Items
      $items.Sort('[ReceivedTime]', $true)
      $count = 0
      foreach ($item in $items) {
        if ($item.Class -ne 43) { continue }
        $normalized = Normalize-MailItem -Item $item -AccountId ([string]$store.StoreID) -FolderName $FolderName
        if ($Query -and (($normalized.subject + ' ' + $normalized.preview + ' ' + $normalized.from + ' ' + $normalized.body).ToLower() -notlike "*$($Query.ToLower())*")) {
          continue
        }
        $result += $normalized
        $count++
        if ($count -ge 50) { break }
      }
    } catch {}
  }
  return $result | Sort-Object receivedAt -Descending
}

function Get-Thread {
  param([string] $ThreadId)
  $ns = Get-OutlookNamespace
  $result = @()
  foreach ($store in $ns.Stores) {
    foreach ($folderName in @('Inbox', 'Sent Items', 'Drafts', 'Archive', 'Deleted Items')) {
      try {
        $folder = $store.GetRootFolder().Folders.Item($folderName)
        foreach ($item in $folder.Items) {
          if ($item.Class -ne 43) { continue }
          if ([string]$item.ConversationID -eq $ThreadId) {
            $normalizedFolder = switch ($folderName) {
              'Sent Items' { 'Sent' }
              'Deleted Items' { 'Trash' }
              default { $folderName }
            }
            $result += Normalize-MailItem -Item $item -AccountId ([string]$store.StoreID) -FolderName $normalizedFolder
          }
        }
      } catch {}
    }
  }
  return $result | Sort-Object receivedAt
}

function Find-MailItem {
  param([string] $MessageId)
  $ns = Get-OutlookNamespace
  return $ns.GetItemFromID($MessageId)
}

function Send-Compose {
  param($Payload)
  $ns = Get-OutlookNamespace
  $mail = (New-Object -ComObject Outlook.Application).CreateItem(0)
  $mail.To = ($Payload.to -join '; ')
  if ($Payload.cc) { $mail.CC = ($Payload.cc -join '; ') }
  $mail.Subject = $Payload.subject
  $mail.Body = $Payload.body
  $mail.Send()
  return @{ ok = $true; live = $true }
}

Write-Host 'Starting Outlook bridge on http://127.0.0.1:45123' -ForegroundColor Cyan
$listener.Start()

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $request = $context.Request
    $path = $request.Url.AbsolutePath
    $query = [System.Web.HttpUtility]::ParseQueryString($request.Url.Query)

    switch ($path) {
      '/health' {
        Write-JsonResponse -Context $context -Data @{ ok = $true; live = $true; provider = 'outlook-bridge' }
      }
      '/mail/accounts' {
        Write-JsonResponse -Context $context -Data (Get-Accounts)
      }
      '/mail/messages' {
        $accountId = if ($query['accountId']) { $query['accountId'] } else { 'all' }
        $folder = if ($query['folder']) { $query['folder'] } else { 'Inbox' }
        $search = if ($query['query']) { $query['query'] } else { '' }
        Write-JsonResponse -Context $context -Data (Get-Messages -AccountId $accountId -FolderName $folder -Query $search)
      }
      '/mail/thread' {
        Write-JsonResponse -Context $context -Data (Get-Thread -ThreadId $query['threadId'])
      }
      '/mail/mark-read' {
        $body = Read-JsonBody -Request $request
        $item = Find-MailItem -MessageId $body.messageId
        $item.UnRead = -not [bool]$body.read
        $item.Save()
        Write-JsonResponse -Context $context -Data @{ ok = $true }
      }
      '/mail/move' {
        $body = Read-JsonBody -Request $request
        $item = Find-MailItem -MessageId $body.messageId
        $store = $item.Parent.Store
        $dest = Get-FolderByName -RootFolder $store.GetRootFolder() -FolderName $body.folder
        $item.Move($dest) | Out-Null
        Write-JsonResponse -Context $context -Data @{ ok = $true }
      }
      '/mail/archive' {
        $body = Read-JsonBody -Request $request
        $item = Find-MailItem -MessageId $body.messageId
        $store = $item.Parent.Store
        $dest = Get-FolderByName -RootFolder $store.GetRootFolder() -FolderName 'Archive'
        $item.Move($dest) | Out-Null
        Write-JsonResponse -Context $context -Data @{ ok = $true }
      }
      '/mail/delete' {
        $body = Read-JsonBody -Request $request
        $item = Find-MailItem -MessageId $body.messageId
        $item.Delete()
        Write-JsonResponse -Context $context -Data @{ ok = $true }
      }
      '/mail/compose' {
        $body = Read-JsonBody -Request $request
        Write-JsonResponse -Context $context -Data (Send-Compose -Payload $body)
      }
      '/mail/reply' {
        $body = Read-JsonBody -Request $request
        $item = Find-MailItem -MessageId $body.messageId
        $reply = $item.Reply()
        $reply.Body = $body.body + "`r`n`r`n" + $reply.Body
        $reply.Send()
        Write-JsonResponse -Context $context -Data @{ ok = $true; live = $true }
      }
      '/mail/forward' {
        $body = Read-JsonBody -Request $request
        $item = Find-MailItem -MessageId $body.messageId
        $forward = $item.Forward()
        $forward.To = ($body.to -join '; ')
        $forward.Body = $body.body + "`r`n`r`n" + $forward.Body
        $forward.Send()
        Write-JsonResponse -Context $context -Data @{ ok = $true; live = $true }
      }
      default {
        Write-JsonResponse -Context $context -Data @{ ok = $false; error = 'NOT_FOUND' } -StatusCode 404
      }
    }
  } catch {
    try {
      Write-JsonResponse -Context $context -Data @{ ok = $false; error = $_.Exception.Message } -StatusCode 500
    } catch {}
  }
}
