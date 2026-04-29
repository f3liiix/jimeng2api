import { query } from "@/lib/db/client.ts";

export class AlertStore {
  async openTokenAlert(tokenId: string, message: string) {
    const existing = await query(
      `SELECT id
       FROM alerts
       WHERE token_id = $1 AND type = 'token_unhealthy' AND status = 'open'
       LIMIT 1`,
      [tokenId],
    );
    if (existing.rowCount) {
      await query(
        `UPDATE alerts
         SET message = $1, created_at = now()
         WHERE id = $2`,
        [message, existing.rows[0].id],
      );
      return;
    }

    await query(
      `INSERT INTO alerts (type, severity, token_id, message)
       VALUES ('token_unhealthy', 'warning', $1, $2)`,
      [tokenId, message],
    );
  }

  async resolveTokenAlerts(tokenId: string) {
    await query(
      `UPDATE alerts
       SET status = 'resolved', resolved_at = now()
       WHERE token_id = $1 AND type = 'token_unhealthy' AND status = 'open'`,
      [tokenId],
    );
  }
}

export const alertStore = new AlertStore();
