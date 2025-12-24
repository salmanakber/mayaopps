import pool from './db';

export interface AuditLogEntry {
  companyId: number;
  userId: number;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'sync';
  entityType: 'user' | 'task' | 'property' | 'company' | 'photo' | 'note' | 'billing';
  entityId: number | string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs 
       (company_id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        entry.companyId,
        entry.userId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        entry.newValues ? JSON.stringify(entry.newValues) : null,
        entry.ipAddress || null,
        entry.userAgent || null,
      ]
    );
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't throw - audit logging should not break main functionality
  }
}

export async function getAuditLogs(
  companyId: number,
  filters?: {
    userId?: number;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<any[]> {
  try {
    let query = `
      SELECT id, company_id, user_id, action, entity_type, entity_id, 
             old_values, new_values, ip_address, user_agent, created_at
      FROM audit_logs
      WHERE company_id = $1
    `;
    const params: any[] = [companyId];
    let paramIndex = 2;

    if (filters?.userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters?.action) {
      query += ` AND action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters?.entityType) {
      query += ` AND entity_type = $${paramIndex}`;
      params.push(filters.entityType);
      paramIndex++;
    }

    if (filters?.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(filters?.limit || 100);

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Get audit logs error:', error);
    return [];
  }
}

export async function exportAuditLogs(
  companyId: number,
  startDate: Date,
  endDate: Date
): Promise<string> {
  try {
    const logs = await getAuditLogs(companyId, {
      startDate,
      endDate,
      limit: 10000,
    });

    // Convert to CSV format
    const headers = ['Timestamp', 'User ID', 'Action', 'Entity Type', 'Entity ID', 'Changes', 'IP Address'];
    const rows = logs.map(log => [
      new Date(log.created_at).toISOString(),
      log.user_id,
      log.action,
      log.entity_type,
      log.entity_id,
      log.old_values && log.new_values 
        ? `${log.old_values} → ${log.new_values}` 
        : 'N/A',
      log.ip_address || 'N/A',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  } catch (error) {
    console.error('Export audit logs error:', error);
    throw error;
  }
}
