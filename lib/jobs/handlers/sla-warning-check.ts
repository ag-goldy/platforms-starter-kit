/**
 * Handler for SLA_WARNING_CHECK jobs
 */

import type { SLAWarningCheckJob, JobResult } from '../types';
import { checkSLAWarnings } from '@/lib/sla/warnings';

export async function processSLAWarningCheckJob(_job: SLAWarningCheckJob): Promise<JobResult> {
  try {
    // If orgId is specified, we could filter by org in the future
    // For now, the checkSLAWarnings function handles all tickets
    const result = await checkSLAWarnings();

    return {
      success: true,
      data: {
        checked: result.checked,
        warningsFound: result.warnings.length,
        notificationsSent: result.notificationsSent,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
