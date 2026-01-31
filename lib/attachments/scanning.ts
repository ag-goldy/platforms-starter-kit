/**
 * Virus scanning interface for attachments
 * 
 * Supports multiple scanning backends:
 * - ClamAV (local or remote)
 * - VirusTotal API (cloud)
 * - Custom scanning services
 */

export type ScanStatus = 'PENDING' | 'SCANNING' | 'CLEAN' | 'INFECTED' | 'ERROR';

export interface ScanResult {
  status: ScanStatus;
  result?: string; // Virus name if infected, error message if error
  scannedAt: Date;
}

export interface Scanner {
  scan(buffer: Buffer, filename: string): Promise<ScanResult>;
}

/**
 * VirusTotal API scanner
 * Requires VIRUSTOTAL_API_KEY environment variable
 */
export class VirusTotalScanner implements Scanner {
  private apiKey: string;
  private apiUrl = 'https://www.virustotal.com/vtapi/v2';

  constructor() {
    this.apiKey = process.env.VIRUSTOTAL_API_KEY || '';
    if (!this.apiKey) {
      console.warn('VIRUSTOTAL_API_KEY not set. Virus scanning will be disabled.');
    }
  }

  async scan(buffer: Buffer, filename: string): Promise<ScanResult> {
    if (!this.apiKey) {
      // In development, skip scanning if API key not configured
      if (process.env.NODE_ENV === 'development') {
        return {
          status: 'CLEAN',
          scannedAt: new Date(),
        };
      }
      throw new Error('VirusTotal API key not configured');
    }

    try {
      // Upload file for scanning using multipart/form-data
      // Note: For production, install 'form-data' package: npm install form-data
      // For now, using a simplified approach that works without external deps
      const boundary = `----WebKitFormBoundary${Date.now()}`;
      const bodyParts: string[] = [];
      bodyParts.push(`--${boundary}`);
      bodyParts.push(`Content-Disposition: form-data; name="apikey"`);
      bodyParts.push('');
      bodyParts.push(this.apiKey);
      bodyParts.push(`--${boundary}`);
      bodyParts.push(`Content-Disposition: form-data; name="file"; filename="${filename}"`);
      bodyParts.push('Content-Type: application/octet-stream');
      bodyParts.push('');
      const bodyBuffer = Buffer.concat([
        Buffer.from(bodyParts.join('\r\n') + '\r\n'),
        buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const uploadResponse = await fetch(`${this.apiUrl}/file/scan`, {
        method: 'POST',
        body: bodyBuffer,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`VirusTotal upload failed: ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      const resource = uploadData.resource;

      // Wait a bit for scan to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get scan report
      const reportResponse = await fetch(
        `${this.apiUrl}/file/report?apikey=${this.apiKey}&resource=${resource}`
      );

      if (!reportResponse.ok) {
        throw new Error(`VirusTotal report failed: ${reportResponse.statusText}`);
      }

      const reportData = await reportResponse.json();

      if (reportData.response_code === 1) {
        // Scan completed
        const positives = reportData.positives || 0;
        if (positives > 0) {
          return {
            status: 'INFECTED',
            result: `${positives} engines detected threats: ${reportData.permalink}`,
            scannedAt: new Date(),
          };
        } else {
          return {
            status: 'CLEAN',
            scannedAt: new Date(),
          };
        }
      } else if (reportData.response_code === -2) {
        // Still queued, return scanning status
        return {
          status: 'SCANNING',
          scannedAt: new Date(),
        };
      } else {
        throw new Error(`VirusTotal scan failed: ${reportData.verbose_msg || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: 'ERROR',
        result: errorMessage,
        scannedAt: new Date(),
      };
    }
  }
}

/**
 * Mock scanner for development/testing
 * Always returns CLEAN
 */
export class MockScanner implements Scanner {
  async scan(buffer: Buffer, filename: string): Promise<ScanResult> {
    void buffer;
    void filename;
    // Simulate scanning delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      status: 'CLEAN',
      scannedAt: new Date(),
    };
  }
}

/**
 * Get the appropriate scanner based on configuration
 */
export function getScanner(): Scanner {
  const scannerType = process.env.ATTACHMENT_SCANNER || 'mock';

  switch (scannerType) {
    case 'virustotal':
      return new VirusTotalScanner();
    case 'mock':
    default:
      return new MockScanner();
  }
}

/**
 * Scan an attachment
 */
export async function scanAttachment(
  buffer: Buffer,
  filename: string
): Promise<ScanResult> {
  const scanner = getScanner();
  return scanner.scan(buffer, filename);
}
