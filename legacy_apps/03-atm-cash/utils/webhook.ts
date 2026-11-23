import { ATMInventory, ATMModuleSettings, ATMTransaction } from '../types';

export interface WebhookResponse {
  ok: boolean;
  message: string;
  syncedAt?: string;
}

export interface WebhookRestoreResponse {
  ok: boolean;
  rawJson?: string;
  message: string;
}

interface WebhookPayload {
  event: 'transaction' | 'full_sync' | 'test_connection';
  app: 'Kwik Stop ATM Cash Tracker';
  currency: 'AUD';
  sentAt: string;
  spreadsheetId?: string;
  inventory?: {
    expectedNotes20: number;
    expectedNotes50: number;
    expectedTotalAUD: number;
  };
  transaction?: ATMTransaction;
  transactions?: ATMTransaction[];
  settings?: {
    thresholds: ATMModuleSettings['thresholds'];
  };
}

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function extractSpreadsheetId(input?: string): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

async function postToAppsScript(url: string, payload: WebhookPayload): Promise<WebhookResponse> {
  if (!url.trim()) {
    return { ok: false, message: 'No Webhook URL configured.' };
  }
  if (!isValidWebhookUrl(url)) {
    return { ok: false, message: 'Webhook URL must be a valid http(s) URL.' };
  }

  const body = JSON.stringify(payload);

  try {
    const res = await fetch(url.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body,
    });

    if (!res.ok) {
      return {
        ok: false,
        message: `Webhook returned HTTP ${res.status}.`,
      };
    }

    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as {
        ok?: boolean;
        error?: string;
        sheetTitle?: string;
        rowsWritten?: number;
      };
      if (parsed.ok === false) {
        return {
          ok: false,
          message: parsed.error || 'Apps Script reported an error.',
        };
      }
      const detailParts: string[] = [];
      if (parsed.sheetTitle) detailParts.push(`Sheet "${parsed.sheetTitle}"`);
      if (typeof parsed.rowsWritten === 'number') {
        detailParts.push(`${parsed.rowsWritten} row${parsed.rowsWritten === 1 ? '' : 's'} written`);
      }
      return {
        ok: true,
        message:
          detailParts.length > 0
            ? `Synced (${detailParts.join(' · ')}).`
            : 'Synced to Google Sheets & Drive.',
        syncedAt: new Date().toISOString(),
      };
    } catch {
      if (text.trim().startsWith('<')) {
        return {
          ok: false,
          message:
            'Google Apps Script returned an HTML page instead of JSON. Check deployment access is set to "Anyone" and redeploy as a New Version.',
        };
      }
      return {
        ok: true,
        message: 'Synced to Google Sheets & Drive.',
        syncedAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    try {
      await fetch(url.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body,
      });
      return {
        ok: true,
        message:
          'Sent to Google Apps Script (browser hid response via CORS). Verify your Google Sheet updated.',
        syncedAt: new Date().toISOString(),
      };
    } catch {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Network error sending webhook.',
      };
    }
  }
}

export async function syncTransactionToWebhook(
  webhookUrl: string,
  transaction: ATMTransaction,
  inventory: ATMInventory,
  settings?: ATMModuleSettings,
  allTransactions?: ATMTransaction[]
): Promise<WebhookResponse> {
  return postToAppsScript(webhookUrl, {
    event: 'transaction',
    app: 'Kwik Stop ATM Cash Tracker',
    currency: 'AUD',
    sentAt: new Date().toISOString(),
    spreadsheetId: extractSpreadsheetId(settings?.spreadsheetId),
    inventory: {
      expectedNotes20: inventory.expectedNotes20,
      expectedNotes50: inventory.expectedNotes50,
      expectedTotalAUD: inventory.expectedNotes20 * 20 + inventory.expectedNotes50 * 50,
    },
    transaction,
    transactions: allTransactions,
    settings: settings
      ? {
          thresholds: settings.thresholds,
        }
      : undefined,
  });
}

export async function syncAllHistoryToWebhook(
  webhookUrl: string,
  transactions: ATMTransaction[],
  inventory: ATMInventory,
  settings: ATMModuleSettings
): Promise<WebhookResponse> {
  return postToAppsScript(webhookUrl, {
    event: 'full_sync',
    app: 'Kwik Stop ATM Cash Tracker',
    currency: 'AUD',
    sentAt: new Date().toISOString(),
    spreadsheetId: extractSpreadsheetId(settings.spreadsheetId),
    inventory: {
      expectedNotes20: inventory.expectedNotes20,
      expectedNotes50: inventory.expectedNotes50,
      expectedTotalAUD: inventory.expectedNotes20 * 20 + inventory.expectedNotes50 * 50,
    },
    transactions,
    settings: {
      thresholds: settings.thresholds,
    },
  });
}

export async function testWebhookConnection(
  webhookUrl: string,
  inventory: ATMInventory,
  spreadsheetId?: string
): Promise<WebhookResponse> {
  return postToAppsScript(webhookUrl, {
    event: 'test_connection',
    app: 'Kwik Stop ATM Cash Tracker',
    currency: 'AUD',
    sentAt: new Date().toISOString(),
    spreadsheetId: extractSpreadsheetId(spreadsheetId),
    inventory: {
      expectedNotes20: inventory.expectedNotes20,
      expectedNotes50: inventory.expectedNotes50,
      expectedTotalAUD: inventory.expectedNotes20 * 20 + inventory.expectedNotes50 * 50,
    },
  });
}

export async function fetchLatestBackupFromWebhook(
  webhookUrl: string
): Promise<WebhookRestoreResponse> {
  if (!webhookUrl.trim()) {
    return { ok: false, message: 'Enter your Google Apps Script Webhook URL first.' };
  }
  if (!isValidWebhookUrl(webhookUrl)) {
    return { ok: false, message: 'Webhook URL must be a valid http(s) URL.' };
  }

  try {
    const separator = webhookUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${webhookUrl.trim()}${separator}action=restore&t=${Date.now()}`, {
      method: 'GET',
    });

    if (!res.ok) {
      return { ok: false, message: `Webhook returned HTTP ${res.status}.` };
    }

    const text = await res.text();
    const parsed = JSON.parse(text) as { ok?: boolean; error?: string; backup?: unknown };
    if (parsed && parsed.ok === false) {
      return {
        ok: false,
        message: parsed.error || 'No backup file found in Google Drive yet.',
      };
    }

    return {
      ok: true,
      rawJson: parsed && parsed.backup ? JSON.stringify(parsed.backup) : text,
      message: 'Fetched latest store state from Google Drive.',
    };
  } catch {
    return {
      ok: false,
      message:
        'Could not read backup directly from Webhook URL. Update your Apps Script with the latest Code.gs (redeploy as New Version), or download the .json file from Google Drive and use Restore JSON File.',
    };
  }
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// Paste into script.google.com -> Save -> Deploy -> Manage deployments -> Edit -> New version -> Deploy
function getSpreadsheet_(payload) {
  if (payload && payload.spreadsheetId) {
    return SpreadsheetApp.openById(payload.spreadsheetId);
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  var files = DriveApp.getFilesByName('ATM Cash Ledger');
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  return SpreadsheetApp.create('ATM Cash Ledger');
}

function getBackupFolder_() {
  var folders = DriveApp.getFoldersByName('Kwik Stop ATM Backups');
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder('Kwik Stop ATM Backups');
}

function upsertJsonFile_(folder, filename, content) {
  var existing = folder.getFilesByName(filename);
  if (existing.hasNext()) {
    existing.next().setContent(content);
  } else {
    folder.createFile(filename, content, MimeType.PLAIN_TEXT);
  }
}

function getLedgerSheet_(ss) {
  var sheet = ss.getSheetByName('ATM_Ledger') || ss.getSheets()[0];
  if (!sheet) {
    sheet = ss.insertSheet('ATM_Ledger');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp', 'Event', 'Tx ID', 'Type', 'Staff',
      '$20 Notes', '$50 Notes', 'Total AUD', 'Reference', 'Expected Balance After'
    ]);
  }
  return sheet;
}

function updateSummarySheet_(ss, inventory) {
  if (!inventory) return;
  var summary = ss.getSheetByName('Current_Balance') || ss.insertSheet('Current_Balance');
  summary.clearContents();
  summary.getRange(1, 1, 5, 2).setValues([
    ['Metric', 'Value'],
    ['Expected $20 Notes', inventory.expectedNotes20],
    ['Expected $50 Notes', inventory.expectedNotes50],
    ['Expected Total AUD', inventory.expectedTotalAUD],
    ['Last Updated', new Date().toISOString()]
  ]);
}

function txToRow_(tx, eventName, expectedTotal) {
  var refText = tx.reference || '';
  if (tx.type === 'cycle_count') {
    var statusTag = tx.status === 'matched' ? 'Matched' : 'Variance $' + tx.varianceTotal;
    refText = refText ? statusTag + ' | ' + refText : statusTag;
  } else if (tx.type === 'adjustment' && tx.reason) {
    refText = tx.reason;
  }
  return [
    tx.timestamp || '',
    eventName,
    tx.id || '',
    tx.type || '',
    tx.staffName || '',
    Number(tx.notes20 || 0),
    Number(tx.notes50 || 0),
    Number(tx.totalAmount || 0),
    refText,
    expectedTotal
  ];
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = getSpreadsheet_(payload);
    var sheet = getLedgerSheet_(ss);
    var expectedTotal = payload.inventory ? payload.inventory.expectedTotalAUD : '';
    var rowsWritten = 0;

    if (payload.event === 'test_connection') {
      updateSummarySheet_(ss, payload.inventory);
    } else if (payload.event === 'transaction' && payload.transaction) {
      sheet.appendRow(txToRow_(payload.transaction, payload.event, expectedTotal));
      updateSummarySheet_(ss, payload.inventory);
      rowsWritten = 1;

      if (payload.transactions) {
        var folder = getBackupFolder_();
        upsertJsonFile_(folder, 'kwik-stop-atm-latest.json', JSON.stringify(payload, null, 2));
      }
    } else if (payload.event === 'full_sync' && payload.transactions) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 10).clearContent();
      }
      var list = payload.transactions.slice().reverse();
      if (list.length > 0) {
        var rows = list.map(function (tx, idx) {
          var balCell = idx === list.length - 1 ? expectedTotal : '';
          return txToRow_(tx, 'full_sync', balCell);
        });
        sheet.getRange(2, 1, rows.length, 10).setValues(rows);
        rowsWritten = rows.length;
      }
      updateSummarySheet_(ss, payload.inventory);

      var backupFolder = getBackupFolder_();
      var jsonString = JSON.stringify(payload, null, 2);
      upsertJsonFile_(backupFolder, 'kwik-stop-atm-latest.json', jsonString);
      upsertJsonFile_(
        backupFolder,
        'kwik-stop-atm-backup-' + new Date().toISOString().slice(0, 10) + '.json',
        jsonString
      );
    }

    SpreadsheetApp.flush();
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        received: payload.event,
        sheetTitle: ss.getName(),
        rowsWritten: rowsWritten
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var folder = getBackupFolder_();
    var latestFiles = folder.getFilesByName('kwik-stop-atm-latest.json');
    if (latestFiles.hasNext()) {
      return ContentService
        .createTextOutput(latestFiles.next().getBlob().getDataAsString())
        .setMimeType(ContentService.MimeType.JSON);
    }

    var files = DriveApp.searchFiles("title contains 'kwik-stop-atm-backup-' and trashed = false");
    var latest = null;
    while (files.hasNext()) {
      var f = files.next();
      if (!latest || f.getLastUpdated().getTime() > latest.getLastUpdated().getTime()) {
        latest = f;
      }
    }
    if (!latest) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'No backup JSON file found in Google Drive.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(latest.getBlob().getDataAsString())
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
