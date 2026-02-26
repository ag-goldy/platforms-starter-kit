'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  batchImportAssetsAction,
  generateAssetImportTemplate,
  parseAssetImportCSV,
  type AssetImportRow,
  type ImportResult,
} from '@/app/s/[subdomain]/actions/asset-import';
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface AssetBatchImportProps {
  orgId: string;
  subdomain: string;
}

export function AssetBatchImport({ orgId, subdomain }: AssetBatchImportProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [parsedRows, setParsedRows] = useState<AssetImportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input');

  const handleDownloadTemplate = async () => {
    try {
      const template = await generateAssetImportTemplate(orgId);
      const blob = new Blob([template], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `asset-import-template-${subdomain}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate template');
    }
  };

  const handleParseCSV = async () => {
    setError(null);
    try {
      const rows = await parseAssetImportCSV(csvContent);
      if (rows.length === 0) {
        setError('No valid rows found in CSV');
        return;
      }
      if (rows.length > 1000) {
        setError('Maximum 1000 rows allowed per import');
        return;
      }
      setParsedRows(rows);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const importResult = await batchImportAssetsAction(orgId, parsedRows);
      setResult(importResult);
      setStep('result');

      if (importResult.success > 0) {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setCsvContent('');
    setParsedRows([]);
    setResult(null);
    setError(null);
    setStep('input');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Batch Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Batch Import Assets
          </DialogTitle>
          <DialogDescription>
            Import multiple assets at once using a CSV file.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
                <Download className="h-4 w-4" />
                Download Template
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" className="gap-2" asChild>
                  <span>
                    <Upload className="h-4 w-4" />
                    Upload CSV
                  </span>
                </Button>
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Or paste CSV content directly:
              </label>
              <Textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="name,type,status,siteName,areaName,hostname,serialNumber,model,vendor,ipAddress,macAddress,notes,accessUrls,tags
Main Firewall,FIREWALL,ACTIVE,Headquarters,Server Room,firewall-01,SN123456,FortiGate 60F,Fortinet,192.168.1.1,00:11:22:33:44:55,Main office,Web:https://192.168.1.1,firewall,network"
                rows={10}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleParseCSV} disabled={!csvContent.trim()}>
                Preview Import
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {parsedRows.length} assets to import. Please review before confirming.
              </p>
            </div>

            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium w-12">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Site</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Area</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 50).map((row, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-2 text-sm text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-2 text-sm font-medium">{row.name}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted">
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">{row.status}</td>
                      <td className="px-4 py-2 text-sm">{row.siteName || '-'}</td>
                      <td className="px-4 py-2 text-sm">{row.areaName || '-'}</td>
                    </tr>
                  ))}
                  {parsedRows.length > 50 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-2 text-center text-muted-foreground">
                        ... and {parsedRows.length - 50} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('input')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={isLoading}>
                {isLoading ? 'Importing...' : `Import ${parsedRows.length} Assets`}
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold text-green-600">{result.success}</p>
                      <p className="text-sm text-green-700">Imported</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                      <p className="text-sm text-red-700">Failed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{parsedRows.length}</p>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Errors:</h4>
                <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium w-16">Row</th>
                        <th className="px-4 py-2 text-left text-xs font-medium">Error</th>
                        <th className="px-4 py-2 text-left text-xs font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, index) => (
                        <tr key={index} className="border-b">
                          <td className="px-4 py-2 text-sm text-muted-foreground">{err.row}</td>
                          <td className="px-4 py-2 text-sm text-red-600">{err.error}</td>
                          <td className="px-4 py-2 text-xs font-mono truncate max-w-[200px]">
                            {err.data.name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Close
              </Button>
              <Button onClick={reset}>Import More</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
