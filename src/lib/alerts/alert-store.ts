import { query } from "@/lib/db/client.ts";

type AlertQuery = (
  sql: string,
  params?: unknown[],
) => Promise<{
  rowCount: number | null;
  rows: any[];
}>;

export type OpenAlertResult = {
  id: string;
  created: boolean;
};

export class AlertStore {
  constructor(private readonly queryFn: AlertQuery = query as AlertQuery) {}

  async openTokenAlert(tokenId: string, message: string): Promise<OpenAlertResult> {
    const existing = await this.queryFn(
      `SELECT id
       FROM alerts
       WHERE token_id = $1 AND type = 'token_unhealthy' AND status = 'open'
       LIMIT 1`,
      [tokenId],
    );
    if (existing.rowCount) {
      await this.queryFn(
        `UPDATE alerts
         SET message = $1, created_at = now()
         WHERE id = $2`,
        [message, existing.rows[0].id],
      );
      return { id: existing.rows[0].id, created: false };
    }

    const created = await this.queryFn(
      `INSERT INTO alerts (type, severity, token_id, message)
       VALUES ('token_unhealthy', 'warning', $1, $2)
       RETURNING id`,
      [tokenId, message],
    );
    return { id: created.rows[0].id, created: true };
  }

  async resolveTokenAlerts(tokenId: string) {
    await this.queryFn(
      `UPDATE alerts
       SET status = 'resolved', resolved_at = now()
       WHERE token_id = $1 AND type = 'token_unhealthy' AND status = 'open'`,
      [tokenId],
    );
  }
}

export const alertStore = new AlertStore();
