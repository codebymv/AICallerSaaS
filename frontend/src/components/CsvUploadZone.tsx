'use client';

import { useState, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface CsvUploadZoneProps {
  onUpload: (csvData: string) => void;
  onPreview?: (leads: any[]) => void;
}

export function CsvUploadZone({ onUpload, onPreview }: CsvUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[] | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateAndParseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Check for required columns
    const hasPhone = header.some(h => h.includes('phone') || h === 'phone number' || h === 'phonenumber');
    
    if (!hasPhone) {
      throw new Error('CSV must include a phone number column (e.g., "phone", "phoneNumber", or "Phone Number")');
    }

    // Parse data rows
    const leads = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const lead: any = {};

      header.forEach((col, index) => {
        if (values[index]) {
          if (col.includes('phone')) {
            lead.phone = values[index];
          } else if (col.includes('name')) {
            lead.name = values[index];
          } else if (col.includes('email')) {
            lead.email = values[index];
          } else {
            lead[col] = values[index];
          }
        }
      });

      // Validate phone number
      const phoneDigits = (lead.phone || '').replace(/\D/g, '');
      if (phoneDigits.length >= 10) {
        leads.push(lead);
      }
    }

    if (leads.length === 0) {
      throw new Error('No valid leads found in CSV. Ensure phone numbers have at least 10 digits.');
    }

    return leads;
  };

  const processFile = async (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);

    try {
      const text = await selectedFile.text();
      const leads = validateAndParseCSV(text);
      
      setPreview(leads.slice(0, 5)); // Show first 5 leads
      
      if (onPreview) {
        onPreview(leads);
      }
    } catch (err: any) {
      setError(err.message);
      setFile(null);
      setPreview(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    
    if (!droppedFile) {
      setError('No file dropped');
      return;
    }

    if (!droppedFile.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    processFile(droppedFile);
  }, [onPreview]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    processFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      const text = await file.text();
      onUpload(text);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setError(null);
    setPreview(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {!file && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-teal-600 bg-teal-50'
              : 'border-slate-300 hover:border-teal-600 hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <p className="text-lg font-medium text-slate-600 mb-2">
              Drop your CSV file here or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              CSV must include phone numbers. Optional: name, email, custom fields
            </p>
          </label>
        </div>
      )}

      {/* File Selected */}
      {file && !error && (
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-600">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                    {preview && ` • ${preview.length} leads preview`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemove}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-600">Upload Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && preview.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="font-medium text-slate-600">Lead Preview (First {preview.length} Rows)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {Object.keys(preview[0]).map((header) => (
                      <th key={header} className="text-left font-medium text-muted-foreground p-2">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((lead, index) => (
                    <tr key={index} className="border-b">
                      {Object.keys(lead).map((key) => (
                        <td key={key} className="p-2">
                          {lead[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Format Guide */}
      <Card className="bg-slate-50">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-slate-600 mb-2">CSV Format Guide:</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Required column: <code className="bg-white px-1 py-0.5 rounded">phone</code> or <code className="bg-white px-1 py-0.5 rounded">phoneNumber</code></p>
            <p>• Optional columns: <code className="bg-white px-1 py-0.5 rounded">name</code>, <code className="bg-white px-1 py-0.5 rounded">email</code>, custom fields</p>
            <p>• Example: <code className="bg-white px-1 py-0.5 rounded text-xs">name,phone,email</code></p>
            <p className="ml-12"><code className="bg-white px-1 py-0.5 rounded text-xs">John Doe,555-1234,(555) 123-4567,john@example.com</code></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


