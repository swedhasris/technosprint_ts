import { query, execute } from './db';
import { calculateSLADeadline } from './slaUtils';

export interface SLAPolicy {
  id?: number;
  name: string;
  priority: string;
  department?: string;
  category?: string;
  responseTimeHours: number;
  resolutionTimeHours: number;
  businessHours: boolean;
  excludeWeekends: boolean;
  excludeHolidays: boolean;
}

export interface SLAAuditLog {
  ticket_id: string;
  sla_type: 'Response' | 'Resolution';
  event_type: 'Start' | 'Pause' | 'Resume' | 'Stop' | 'Breach' | 'Warning';
  timestamp: string;
  reason?: string;
}

export class SLAEngine {
  
  static calculateDeadline(startTime: Date, hours: number, policy: Partial<SLAPolicy>): Date {
    return calculateSLADeadline(startTime, hours, {
      businessHours: policy.businessHours,
      excludeWeekends: policy.excludeWeekends,
      excludeHolidays: policy.excludeHolidays
    });
  }

  static async logSLAEvent(log: SLAAuditLog) {
    try {
      await execute(`
        INSERT INTO sla_audit_logs (ticket_id, sla_type, event_type, timestamp, reason)
        VALUES (?, ?, ?, ?, ?)
      `, [log.ticket_id, log.sla_type, log.event_type, log.timestamp, log.reason]);
    } catch (e) {
      console.error('[SLAEngine] Failed to log SLA event:', e);
    }
  }

  static async monitorBreaches() {
    const now = new Date();
    const nowStr = now.toISOString();

    try {
      // 1. Monitor Response SLAs
      const responseSlas = await query(`
        SELECT id, ticket_number, response_deadline, response_sla_start_time, response_sla_status 
        FROM tickets 
        WHERE response_sla_status != 'Completed' AND response_sla_status != 'Resolved'
      `);

      for (const ticket of responseSlas) {
        const deadline = new Date(ticket.response_deadline).getTime();
        const start = new Date(ticket.response_sla_start_time || ticket.created_at).getTime();
        const total = deadline - start;
        const elapsed = now.getTime() - start;
        const usedPct = total > 0 ? (elapsed / total) * 100 : 0;

        if (usedPct >= 100 && ticket.response_sla_status !== 'Breached') {
          await execute("UPDATE tickets SET response_sla_status = 'Breached' WHERE id = ?", [ticket.id]);
          await this.logSLAEvent({ ticket_id: ticket.id.toString(), sla_type: 'Response', event_type: 'Breach', timestamp: nowStr, reason: 'SLA Used 100% - Management Notified' });
        } else if (usedPct >= 90 && ticket.response_sla_status === 'In Progress') {
          await this.logSLAEvent({ ticket_id: ticket.id.toString(), sla_type: 'Response', event_type: 'Warning', timestamp: nowStr, reason: 'SLA Used 90% - Team Lead Notified' });
        } else if (usedPct >= 80 && ticket.response_sla_status === 'In Progress') {
          await this.logSLAEvent({ ticket_id: ticket.id.toString(), sla_type: 'Response', event_type: 'Warning', timestamp: nowStr, reason: 'SLA Used 80% - Engineer Notified' });
        }
      }

      // 2. Monitor Resolution SLAs
      const resolutionSlas = await query(`
        SELECT id, ticket_number, resolution_deadline, resolution_sla_start_time, resolution_sla_status 
        FROM tickets 
        WHERE resolution_sla_status = 'In Progress' 
        AND status NOT IN ('Resolved', 'Closed', 'On Hold', 'Waiting for Customer')
      `);

      for (const ticket of resolutionSlas) {
        const deadline = new Date(ticket.resolution_deadline).getTime();
        const start = new Date(ticket.resolution_sla_start_time || ticket.created_at).getTime();
        const total = deadline - start;
        const elapsed = now.getTime() - start;
        const usedPct = total > 0 ? (elapsed / total) * 100 : 0;

        if (usedPct >= 100 && ticket.resolution_sla_status !== 'Breached') {
          await execute("UPDATE tickets SET resolution_sla_status = 'Breached' WHERE id = ?", [ticket.id]);
          await this.logSLAEvent({ ticket_id: ticket.id.toString(), sla_type: 'Resolution', event_type: 'Breach', timestamp: nowStr, reason: 'SLA Used 100% - Management Notified' });
        } else if (usedPct >= 90) {
          await this.logSLAEvent({ ticket_id: ticket.id.toString(), sla_type: 'Resolution', event_type: 'Warning', timestamp: nowStr, reason: 'SLA Used 90% - Team Lead Notified' });
        } else if (usedPct >= 80) {
          await this.logSLAEvent({ ticket_id: ticket.id.toString(), sla_type: 'Resolution', event_type: 'Warning', timestamp: nowStr, reason: 'SLA Used 80% - Engineer Notified' });
        }
      }
    } catch (e) {
      console.error('[SLAEngine] Breach monitor failed:', e);
    }
  }
}
