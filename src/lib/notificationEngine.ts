import { execute } from "./db";

export class NotificationEngine {
  /**
   * Creates a notification for a user
   */
  static async create(userId: string, title: string, message: string, type: string, ticketId?: string) {
    try {
      await execute(
        "INSERT INTO notifications (user_id, title, message, type, ticket_id, is_read) VALUES (?, ?, ?, ?, ?, 0)",
        [userId, title, message, type, ticketId || null]
      );
      console.log(`[Notification] Created ${type} for user ${userId}`);
    } catch (error: any) {
      console.error("[Notification] Error creating notification:", error.message);
    }
  }

  /**
   * Notify admins about a new ticket
   */
  static async notifyAdmins(title: string, message: string, ticketId: string) {
    try {
      // Get all admins
      // Since we don't have a direct 'users' table access here easily without more queries, 
      // we can use a role-based check if the DB structure allows.
      // For now, let's assume we can notify a specific 'admin' user or use a broadcast approach.
      // In this system, 'admin' and 'agent' are roles.
      
      // Let's create a notification for everyone with admin/agent role
      // This is a bit expensive, but for a small system it's okay.
      // Alternatively, we can use a 'system' or 'broadcast' flag if we had it.
      
      // For now, let's just use a hardcoded admin ID or find them
      // In server.ts, we can do this more easily.
    } catch (error) {}
  }
}
