import { getDb, queryAll, execute, saveDb } from "./db";

export async function checkReminders(): Promise<number> {
  const db = await getDb();

  // Get all active reminder configs
  const configs = queryAll<{ id: number; days_before_expiry: number }>(
    "SELECT id, days_before_expiry FROM reminder_configs WHERE is_enabled = 1 AND user_id = 1"
  );

  let created = 0;

  for (const config of configs) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + config.days_before_expiry);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    // Find certificates expiring exactly on targetDate that have active vendors
    const certs = queryAll<{ id: number; vendor_id: number; file_name: string }>(
      `SELECT c.id, c.vendor_id, c.file_name
       FROM certificates c
       JOIN vendors v ON v.id = c.vendor_id
       WHERE c.expiration_date = ?
         AND c.status != 'rejected'
         AND v.status = 'active'
         AND v.reminders_paused = 0`,
      [targetDateStr]
    );

    for (const cert of certs) {
      // Check no duplicate reminder exists
      const existing = queryAll<{ id: number }>(
        `SELECT id FROM reminders
         WHERE certificate_id = ? AND reminder_config_id = ? AND scheduled_date = ?`,
        [cert.id, config.id, targetDateStr]
      );

      if (existing.length === 0) {
        // Get vendor email
        const vendor = queryAll<{ contact_email: string }>(
          "SELECT contact_email FROM vendors WHERE id = ?", [cert.vendor_id]
        );

        execute(
          `INSERT INTO reminders (certificate_id, vendor_id, reminder_config_id, scheduled_date, status, recipient_email, created_at)
           VALUES (?, ?, ?, ?, 'queued', ?, datetime('now'))`,
          [cert.id, cert.vendor_id, config.id, targetDateStr, vendor[0]?.contact_email || null]
        );
        created++;
      }
    }
  }

  saveDb();
  return created;
}

export async function sendReminders(): Promise<number> {
  await getDb();

  // Get all queued reminders
  const pending = queryAll<{ id: number; vendor_id: number; certificate_id: number; scheduled_date: string; recipient_email: string | null }>(
    "SELECT id, vendor_id, certificate_id, scheduled_date, recipient_email FROM reminders WHERE status = 'queued'"
  );

  let sent = 0;

  for (const r of pending) {
    const status = r.recipient_email ? 'sent' : 'failed';
    execute(
      `UPDATE reminders SET status = ?, sent_at = datetime('now') WHERE id = ?`,
      [status, r.id]
    );

    if (status === 'sent') {
      // Simulate email send
      console.log(`[Reminder] Sending to ${r.recipient_email}: Certificate ${r.certificate_id} for vendor ${r.vendor_id} expiring on ${r.scheduled_date}`);
      sent++;
    } else {
      console.log(`[Reminder] Failed to send reminder for certificate ${r.certificate_id}: no recipient email`);
    }
  }

  saveDb();
  return sent;
}
