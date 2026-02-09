/**
 * Job queue types and definitions
 */

export type JobType =
  | 'SEND_EMAIL'
  | 'GENERATE_EXPORT'
  | 'GENERATE_ORG_EXPORT'
  | 'RECALCULATE_SLA'
  | 'PROCESS_ATTACHMENT'
  | 'AUDIT_COMPACTION'
  | 'SLA_WARNING_CHECK';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface BaseJob {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
  error?: string;
  data: unknown;
}

export interface SendEmailJob extends BaseJob {
  type: 'SEND_EMAIL';
  data: {
    type: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
  };
}

export interface GenerateExportJob extends BaseJob {
  type: 'GENERATE_EXPORT';
  data: {
    format: 'CSV' | 'JSON';
    filters: unknown;
    userId: string;
    orgId?: string;
  };
}

export interface GenerateOrgExportJob extends BaseJob {
  type: 'GENERATE_ORG_EXPORT';
  data: {
    exportRequestId: string;
    orgId: string;
    requestedById: string;
  };
}

export interface RecalculateSLAJob extends BaseJob {
  type: 'RECALCULATE_SLA';
  data: {
    ticketIds?: string[];
    orgId?: string;
  };
}

export interface ProcessAttachmentJob extends BaseJob {
  type: 'PROCESS_ATTACHMENT';
  data: {
    attachmentId: string;
    action: 'SCAN' | 'GENERATE_THUMBNAIL';
  };
}

export interface AuditCompactionJob extends BaseJob {
  type: 'AUDIT_COMPACTION';
  data: {
    orgId?: string;
    retentionDays: number;
  };
}

export interface SLAWarningCheckJob extends BaseJob {
  type: 'SLA_WARNING_CHECK';
  data: {
    orgId?: string; // Optional: check specific org, or all if not provided
  };
}

export type Job =
  | SendEmailJob
  | GenerateExportJob
  | GenerateOrgExportJob
  | RecalculateSLAJob
  | ProcessAttachmentJob
  | AuditCompactionJob
  | SLAWarningCheckJob;

export interface JobResult {
  success: boolean;
  error?: string;
  data?: unknown;
}
