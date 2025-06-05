import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data: any;
  new_data: any;
  ip_address: string;
  user_agent: string;
  additional_info: any;
}

const AuditLogViewer = () => {
  const { supabase } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [userEmails, setUserEmails] = useState<string[]>([]);
  const itemsPerPage = 20;

  // Fetch unique user emails
  useEffect(() => {
    const fetchUserEmails = async () => {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('additional_info');

        if (error) throw error;

        // Extract unique emails from all logs
        const uniqueEmails = Array.from(new Set(
          data
            .map(log => log.additional_info?.user_email)
            .filter(Boolean) // Remove null/undefined values
        )).sort();

        setUserEmails(uniqueEmails);
      } catch (error) {
        console.error('Error fetching user emails:', error);
      }
    };

    fetchUserEmails();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

      if (actionFilter && actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }
      if (dateFilter) {
        query = query.gte('timestamp', `${dateFilter}T00:00:00`)
          .lte('timestamp', `${dateFilter}T23:59:59`);
      }
      if (userFilter && userFilter !== 'all') {
        query = query.eq('additional_info->user_email', userFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, dateFilter, userFilter]);

  const formatData = (data: any) => {
    if (!data) return '';
    return typeof data === 'object' ? JSON.stringify(data, null, 2) : data.toString();
  };

  const renderDiff = (oldData: any, newData: any) => {
    if (!oldData && !newData) return null;
    return (
      <div className="whitespace-pre-wrap font-mono text-sm">
        {oldData && (
          <div className="text-red-500">
            - {formatData(oldData)}
          </div>
        )}
        {newData && (
          <div className="text-green-500">
            + {formatData(newData)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>
      
      <div className="flex gap-4 mb-6">
        <Select
          value={actionFilter}
          onValueChange={(value) => setActionFilter(value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="INSERT">Insert</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
            <SelectItem value="LOGIN">Login</SelectItem>
            <SelectItem value="LOGOUT">Logout</SelectItem>
            <SelectItem value="ROLE_CHANGE">Role Change</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-[200px]"
        />

        <Select
          value={userFilter}
          onValueChange={(value) => setUserFilter(value)}
        >
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Filter by user" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">All Users</SelectItem>
            {userEmails.map((email) => (
              <SelectItem key={email} value={email}>
                {email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center">Loading...</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    {log.additional_info?.user_email || 'Unknown'}
                  </TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.table_name}</TableCell>
                  <TableCell>
                    {renderDiff(log.old_data, log.new_data)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-between items-center mt-4">
            <Button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span>Page {page}</span>
            <Button
              onClick={() => setPage(p => p + 1)}
              disabled={logs.length < itemsPerPage}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogViewer; 