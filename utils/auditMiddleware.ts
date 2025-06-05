import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import { NextHandler } from 'next-connect';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface AuditedRequest extends NextApiRequest {
  audit: {
    log: (action: string, additionalInfo?: any) => Promise<void>;
  };
}

export const auditMiddleware = async (
  req: AuditedRequest,
  res: NextApiResponse,
  next: NextHandler
) => {
  // Get the user's token from the request
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) {
    return next();
  }

  // Get user information from the token
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return next();
  }

  // Attach audit logging function to the request
  req.audit = {
    log: async (action: string, additionalInfo: any = {}) => {
      try {
        await supabase.rpc('record_audit_log', {
          p_action: action,
          p_additional_info: {
            ...additionalInfo,
            ip_address: req.socket.remoteAddress,
            user_agent: req.headers['user-agent'],
            request_path: req.url,
            request_method: req.method,
          }
        });
      } catch (error) {
        console.error('Failed to record audit log:', error);
      }
    }
  };

  // Log authentication events
  if (req.url?.includes('/api/auth')) {
    const action = req.url.includes('logout') ? 'LOGOUT' : 'LOGIN';
    await req.audit.log(action);
  }

  return next();
};

export default auditMiddleware; 