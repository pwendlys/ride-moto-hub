import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AuditLogEntry {
  id?: string;
  user_id: string;
  action: string;
  table_name?: string;
  record_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

export const useAuditLog = () => {
  const { user } = useAuth();

  const logAction = async (
    action: string,
    tableName?: string,
    recordId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ) => {
    if (!user) return;

    try {
      const logEntry: Omit<AuditLogEntry, 'id' | 'created_at'> = {
        user_id: user.id,
        action,
        table_name: tableName,
        record_id: recordId,
        old_values: oldValues,
        new_values: newValues,
        ip_address: await getClientIP(),
        user_agent: navigator.userAgent,
      };

      // Store audit log (we'd need to create this table)
      console.log('Audit Log:', logEntry);
      
      // For now, we'll log to console. In production, this should go to a secure audit table
      // await supabase.from('audit_logs').insert(logEntry);
      
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  };

  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const { ip } = await response.json();
      return ip;
    } catch {
      return 'unknown';
    }
  };

  return { logAction };
};