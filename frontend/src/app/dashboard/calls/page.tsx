'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, ArrowUpRight, ArrowDownLeft, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDuration, formatDate, formatPhoneNumber } from '@/lib/utils';

export default function CallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState({ status: '', search: '' });

  const fetchCalls = async (pageNum: number = 1) => {
    try {
      const response = await api.getCalls({
        page: pageNum,
        limit: 20,
        status: filter.status || undefined,
      });
      
      if (pageNum === 1) {
        setCalls(response.data || []);
      } else {
        setCalls((prev) => [...prev, ...(response.data || [])]);
      }
      setHasMore(response.meta?.hasMore || false);
    } catch (error) {
      console.error('Failed to fetch calls:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls(1);
  }, [filter.status]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCalls(nextPage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calls</h1>
          <p className="text-muted-foreground">View and manage your call history</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone number..."
                className="pl-10"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              />
            </div>
            <select
              className="px-3 py-2 border rounded-md"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In Progress</option>
              <option value="failed">Failed</option>
              <option value="no-answer">No Answer</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Calls List */}
      {calls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Phone className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No calls yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              When you make or receive calls with your agents, they'll appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-sm text-muted-foreground">
                    <th className="text-left p-4 font-medium">Direction</th>
                    <th className="text-left p-4 font-medium">Phone</th>
                    <th className="text-left p-4 font-medium">Agent</th>
                    <th className="text-left p-4 font-medium">Duration</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Date</th>
                    <th className="text-left p-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-b hover:bg-slate-50">
                      <td className="p-4">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            call.direction === 'inbound'
                              ? 'bg-blue-100'
                              : 'bg-green-100'
                          }`}
                        >
                          {call.direction === 'inbound' ? (
                            <ArrowDownLeft className="h-4 w-4 text-blue-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-sm">
                          {formatPhoneNumber(call.direction === 'inbound' ? call.from : call.to)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{call.agent?.name || 'Unknown'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">
                          {call.duration ? formatDuration(call.duration) : '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        <CallStatusBadge status={call.status} />
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(call.createdAt)}
                        </span>
                      </td>
                      <td className="p-4">
                        <Link href={`/dashboard/calls/${call.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="p-4 text-center border-t">
                <Button variant="outline" onClick={loadMore}>
                  Load More
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CallStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    ringing: 'bg-yellow-100 text-yellow-700',
    'no-answer': 'bg-gray-100 text-gray-600',
    busy: 'bg-orange-100 text-orange-700',
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}
