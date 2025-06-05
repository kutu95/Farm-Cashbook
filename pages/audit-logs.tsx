import { NextPage } from 'next';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import AuditLogViewer from '@/components/AuditLogViewer';

const AuditLogsPage: NextPage = () => {
  const session = useSession();
  const router = useRouter();
  const supabase = useSupabaseClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }

    const checkAdminStatus = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single();

      if (error || !data) {
        router.push('/'); // Redirect non-admins to home
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    };

    checkAdminStatus();
  }, [session, router, supabase]);

  if (!session || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // This shouldn't render as the user will be redirected
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto py-6">
        <AuditLogViewer />
      </main>
    </div>
  );
};

export default AuditLogsPage; 