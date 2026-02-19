"use client";

import { parse } from "csv-parse/sync";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { bulkImportUsers } from "@/actions/admin/users";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// DB Fields available for mapping
const DB_FIELDS = [
  { label: "Full Name", value: "name", required: true },
  { label: "Email", value: "email", required: true },
  { label: "Role (admin/student)", value: "role" },
  { label: "Branch", value: "branch" },
  { label: "Section", value: "section" },
  { label: "Date of Birth (YYYY-MM-DD)", value: "dob" },
  { label: "Gender", value: "gender" },
  { label: "Regulation", value: "regulation" },
  { label: "Roll No / Username", value: "username" },
  { label: "Group Name", value: "groupName" }, // Special field for group creation
];

export function UserImportWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [_file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [config, setConfig] = useState({
    passwordFromDob: true,
    defaultPassword: "ChangeMe123!",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const text = await selectedFile.text();
      try {
        const records = parse(text, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        });
        if (records.length > 0) {
          setCsvHeaders(Object.keys(records[0] as object));
          setCsvData(records);
          setStep(2);
        } else {
          toast.error("CSV file is empty or invalid.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse CSV file.");
      }
    }
  };

  const autoMap = () => {
    const newMappings: Record<string, string> = {};
    csvHeaders.forEach((header) => {
      const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = DB_FIELDS.find((field) => {
        const lowerField = field.value.toLowerCase();
        const lowerLabel = field.label.toLowerCase().replace(/[^a-z0-9]/g, "");
        return (
          lowerHeader === lowerField ||
          lowerHeader === lowerLabel ||
          lowerHeader.includes(lowerField)
        );
      });
      if (match) {
        newMappings[match.value] = header; // Map DB Field -> CSV Header
      }
    });
    setMappings(newMappings);
  };

  const handleMappingChange = (dbField: string, csvHeader: string) => {
    setMappings((prev) => ({ ...prev, [dbField]: csvHeader }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Prepare data based on mappings
      const payload = csvData.map((row) => {
        const mappedRow: any = {};
        Object.entries(mappings).forEach(([dbField, csvHeader]) => {
          if (csvHeader && row[csvHeader] !== undefined) {
            mappedRow[dbField] = row[csvHeader];
          }
        });
        return mappedRow;
      });

      const response = await bulkImportUsers({
        users: payload,
        config,
      });

      if (response.success) {
        setResult(response);
        setStep(3);
        toast.success(`Successfully imported ${response.count} users.`);
      } else {
        toast.error(`Import failed: ${response.message}`);
      }
    } catch (error: any) {
      toast.error(`An error occurred: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Steps
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between">
          <div className="flex flex-col">
            <CardTitle>Bulk User Import</CardTitle>
            <CardDescription>
              Step {step} of 3:{" "}
              {step === 1
                ? "Upload CSV"
                : step === 2
                  ? "Map Fields"
                  : "Results"}
            </CardDescription>
          </div>
          {step === 2 && (
            <Button variant="outline" size="sm" onClick={autoMap}>
              Auto-Map Fields
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg space-y-4">
            <FileUp className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Drag and drop your CSV file here, or click to browse.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supported format: .csv
              </p>
            </div>
            <Input
              type="file"
              accept=".csv"
              className="max-w-xs"
              onChange={handleFileChange}
            />
            <div className="mt-4 text-left w-full max-w-xs text-xs text-muted-foreground space-y-1">
              <p>Sample Headers:</p>
              <code className="bg-muted px-1 rounded block">
                Full Name, Email, Role, Branch, Section
              </code>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-5">
              {DB_FIELDS.map((field) => (
                <div key={field.value} className="space-y-2">
                  <Label className="text-sm font-medium">
                    {field.label}{" "}
                    {field.required && <span className="text-red-500">*</span>}
                  </Label>
                  <Select
                    value={mappings[field.value] || ""}
                    onValueChange={(val) =>
                      handleMappingChange(
                        field.value,
                        val === "__ignore__" ? "" : val,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select CSV Column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore__">-- Ignore --</SelectItem>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Configuration</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pwd-dob"
                  checked={config.passwordFromDob}
                  onCheckedChange={(c) =>
                    setConfig((p) => ({ ...p, passwordFromDob: !!c }))
                  }
                />
                <Label htmlFor="pwd-dob">
                  Generate Password from Date of Birth (DDMMYYYY)
                </Label>
              </div>
              {!config.passwordFromDob && (
                <div className="space-y-1">
                  <Label htmlFor="def-pwd">Default Password</Label>
                  <Input
                    id="def-pwd"
                    value={config.defaultPassword}
                    onChange={(e) =>
                      setConfig((p) => ({
                        ...p,
                        defaultPassword: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Preview</AlertTitle>
              <AlertDescription>
                Ready to import <strong>{csvData.length}</strong> records.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 3 && result && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h3 className="text-2xl font-bold">Import Successful!</h3>
            <p className="text-muted-foreground text-center">
              Processed {result.count} users successfully.
              <br />
              Created/Found {result.groupCount} groups.
            </p>
            {/* Download generated creds button could go here */}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {step > 1 && step < 3 && (
          <Button
            variant="outline"
            onClick={() => setStep((s) => (s - 1) as any)}
            disabled={isSubmitting}
          >
            Back
          </Button>
        )}
        {step === 1 && <div />}

        {step === 2 && (
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              DB_FIELDS.filter((f) => f.required).some(
                (f) => !mappings[f.value],
              )
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              "Run Import"
            )}
          </Button>
        )}
        {step === 3 && (
          <Button
            onClick={() => {
              setStep(1);
              setFile(null);
              setResult(null);
            }}
          >
            Import More
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
