'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Briefcase, Clock, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import type { OpsMetrics } from '@/lib/monitoring/ops-metrics';

interface OpsDashboardProps {
  metrics: OpsMetrics;
}

export function OpsDashboard({ metrics }: OpsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-red-600" />
              Failed Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.failedEmails.count}</div>
            <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-orange-600" />
              Failed Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.failedJobs.count}</div>
            <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              SLA Breaches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.slaBreaches.count}</div>
            <p className="text-xs text-gray-500 mt-1">Today</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-600" />
              Quarantined Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.quarantinedAttachments.count}</div>
            <p className="text-xs text-gray-500 mt-1">Total</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              Automation Failures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.automationFailures.count}</div>
            <p className="text-xs text-gray-500 mt-1">Not tracked</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failed Emails */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Failed Emails</CardTitle>
              {metrics.failedEmails.count > 0 && (
                <Link href="/app/admin/jobs" className="text-sm text-blue-600 hover:underline">
                  View All
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {metrics.failedEmails.recent.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No failed emails
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.failedEmails.recent.map((email) => (
                  <div key={email.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{email.subject}</p>
                        <p className="text-xs text-gray-500 truncate">To: {email.to}</p>
                        {email.lastError && (
                          <p className="text-xs text-red-600 mt-1 truncate">{email.lastError}</p>
                        )}
                      </div>
                      <Badge variant="destructive" className="ml-2">
                        {email.attempts} attempts
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(email.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Failed Jobs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Failed Jobs</CardTitle>
              {metrics.failedJobs.count > 0 && (
                <Link href="/app/admin/jobs" className="text-sm text-blue-600 hover:underline">
                  View All
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {metrics.failedJobs.recent.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No failed jobs
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.failedJobs.recent.map((job) => (
                  <div key={job.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{job.type}</p>
                        <p className="text-xs text-red-600 mt-1 truncate">{job.error}</p>
                      </div>
                      <Badge variant="destructive" className="ml-2">
                        {job.attempts} attempts
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(job.failedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* SLA Breaches */}
        <Card>
          <CardHeader>
            <CardTitle>SLA Breaches Today</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.slaBreaches.recent.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No SLA breaches today
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.slaBreaches.recent.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/app/tickets/${ticket.id}`}
                    className="block border rounded-lg p-3 hover:bg-gray-50 transition-colors space-y-1"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{ticket.key}</p>
                        <p className="text-xs text-gray-600 truncate">{ticket.subject}</p>
                        <div className="flex gap-2 mt-1">
                          {ticket.slaResponseTargetHours && !ticket.firstResponseAt && (
                            <Badge variant="destructive" className="text-xs">
                              Response Overdue
                            </Badge>
                          )}
                          {ticket.slaResolutionTargetHours && (
                            <Badge variant="destructive" className="text-xs">
                              Resolution Overdue
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {ticket.priority}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Quarantined Attachments */}
        <Card>
          <CardHeader>
            <CardTitle>Quarantined Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.quarantinedAttachments.recent.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No quarantined attachments
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.quarantinedAttachments.recent.map((attachment) => (
                  <div key={attachment.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.filename}</p>
                        {attachment.scanResult && (
                          <p className="text-xs text-red-600 mt-1">{attachment.scanResult}</p>
                        )}
                      </div>
                      <Badge variant="destructive" className="ml-2">
                        Quarantined
                      </Badge>
                    </div>
                    {attachment.scannedAt && (
                      <p className="text-xs text-gray-400">
                        Scanned: {new Date(attachment.scannedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
