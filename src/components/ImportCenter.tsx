"use client";

import * as React from "react";
import { commitImportAction, previewImportAction } from "@/app/actions/imports";
import { Badge, Button, Card, CardHeader, cn } from "@/components/ui";
import {
  IMPORT_DEFINITIONS,
  IMPORT_KINDS,
  type ImportCommitResult,
  type ImportKind,
  type ImportPreview,
} from "@/lib/imports/types";

function download(name: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function ImportCenter() {
  const [kind, setKind] = React.useState<ImportKind>("players");
  const [csv, setCsv] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [result, setResult] = React.useState<ImportCommitResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const definition = IMPORT_DEFINITIONS[kind];
  async function readFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setPreview(null);
    setFileName(file.name);
    setCsv(await file.text());
  }

  async function validate() {
    if (!csv.trim()) {
      setError("Choose a CSV file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await previewImportAction(kind, csv);
      if (!response.ok) setError(response.error);
      else setPreview(response.data);
    } catch {
      setError("Could not validate the file.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview?.canImport) return;
    setBusy(true);
    setError(null);
    try {
      const response = await commitImportAction(kind, csv);
      if (!response.ok) setError(response.error);
      else {
        setResult(response.data);
        setPreview(null);
      }
    } catch {
      setError("Import failed. No rows were saved.");
    } finally {
      setBusy(false);
    }
  }

  function changeKind(next: ImportKind) {
    setKind(next);
    setCsv("");
    setFileName("");
    setPreview(null);
    setResult(null);
    setError(null);
  }

  const template = `${definition.fields.map((field) => field.key).join(",")}\n${definition.sample.join("\n")}\n`;

  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_1fr]">
      <Card className="h-fit">
        <CardHeader title="Import type" description="Choose what the CSV contains." />
        <div className="space-y-1 p-3">
          {IMPORT_KINDS.map((option) => {
            const item = IMPORT_DEFINITIONS[option];
            return (
              <button
                key={option}
                type="button"
                onClick={() => changeKind(option)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-left transition-all",
                  kind === option ? "border-fg bg-fg text-white shadow-[3px_3px_0_rgba(11,32,48,.18)]" : "border-transparent hover:border-line-strong hover:bg-bg-raised",
                )}
              >
                <span className="block text-sm font-black">{item.label}</span>
                <span className={cn("mt-0.5 block text-xs", kind === option ? "text-white/70" : "text-muted")}>{item.description}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader
            title={definition.label}
            description={definition.description}
            aside={<Badge tone="gold">Server validated</Badge>}
          />
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border-2 border-fg bg-bg-elevated px-4 text-sm font-black text-fg shadow-[2px_2px_0_rgba(11,32,48,.1)] transition-transform hover:-translate-y-0.5">
                Choose CSV
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} />
              </label>
              <Button variant="secondary" onClick={() => download(`${kind}-template.csv`, template)}>
                Download template
              </Button>
              {fileName ? <span className="text-sm font-semibold text-muted">{fileName}</span> : null}
            </div>

            <div className="rounded-xl border-2 border-dashed border-line-strong bg-bg-raised p-4">
              <p className="text-xs font-black uppercase tracking-wider text-muted">Expected columns</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {definition.fields.map((field) => (
                  <code key={field.key} className={cn("rounded-md px-2 py-1 text-xs", field.required ? "bg-fg text-white" : "bg-surface text-muted")}>
                    {field.key}{field.required ? " *" : ""}
                  </code>
                ))}
              </div>
            </div>

            {csv ? (
              <details className="rounded-xl border border-line bg-bg-raised p-3">
                <summary className="cursor-pointer text-sm font-bold text-fg">View raw CSV</summary>
                <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap text-xs text-muted">{csv}</pre>
              </details>
            ) : null}

            {error ? <p role="alert" className="rounded-lg border-2 border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void validate()} loading={busy} disabled={!csv.trim()}>
                Validate & preview
              </Button>
              {preview ? (
                <Button variant="success" onClick={() => void commit()} loading={busy} disabled={!preview.canImport}>
                  Import {preview.validRows} rows
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        {preview ? <PreviewPanel preview={preview} /> : null}
        {result ? <ResultPanel result={result} /> : null}
      </div>
    </div>
  );
}

function PreviewPanel({ preview }: { preview: ImportPreview }) {
  const errors = preview.issues.filter((entry) => entry.severity === "error");
  return (
    <Card>
      <CardHeader
        title="Validation preview"
        description={`${preview.totalRows} rows found · ${preview.validRows} valid`}
        aside={<Badge tone={preview.canImport ? "success" : "danger"}>{preview.canImport ? "Ready" : `${errors.length} errors`}</Badge>}
      />
      {preview.issues.length ? (
        <div className="border-b-2 border-line bg-danger/5 p-4">
          <p className="text-sm font-black text-danger">Fix these issues before importing</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-danger">
            {preview.issues.map((entry, index) => (
              <li key={`${entry.row}-${entry.field}-${index}`}>
                Row {entry.row}{entry.field ? ` · ${entry.field}` : ""}: {entry.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-xs">
          <thead className="border-b-2 border-line bg-bg-raised uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-black">Row</th>
              {Object.keys(preview.rows[0]?.values ?? {}).map((key) => <th key={key} className="px-4 py-3 font-black">{key}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {preview.rows.slice(0, 12).map((row) => (
              <tr key={row.row} className="hover:bg-bg-raised">
                <td className="px-4 py-2 font-black text-subtle">{row.row}</td>
                {Object.keys(preview.rows[0]?.values ?? {}).map((key) => <td key={key} className="max-w-xs truncate px-4 py-2 text-fg">{row.values[key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.rows.length > 12 ? <p className="border-t border-line px-4 py-3 text-xs text-muted">Showing the first 12 rows. All {preview.rows.length} rows will be checked.</p> : null}
    </Card>
  );
}

function ResultPanel({ result }: { result: ImportCommitResult }) {
  const credentials = result.generatedCredentials;
  const credentialCsv = ["name,email,password,role", ...credentials.map((entry) => [entry.name, entry.email, entry.password, entry.role].map(escapeCsv).join(","))].join("\n") + "\n";
  return (
    <Card>
      <CardHeader title="Import complete" description={`${result.imported} records were committed atomically.`} aside={<Badge tone="success">Saved</Badge>} />
      <div className="space-y-4 p-5">
        {result.createdMatchCodes.length ? <p className="text-sm text-muted">Created match codes: <span className="font-black text-fg">{result.createdMatchCodes.join(", ")}</span></p> : null}
        {credentials.length ? (
          <div className="rounded-xl border-2 border-warning/40 bg-warning/10 p-4">
            <p className="font-black text-fg">Temporary passwords generated</p>
            <p className="mt-1 text-sm text-muted">Download this once. Passwords are not shown again after leaving this page.</p>
            <Button className="mt-3" variant="secondary" onClick={() => download("stadium-of-elite-credentials.csv", credentialCsv)}>
              Download credentials CSV
            </Button>
          </div>
        ) : null}
        <p className="text-sm text-success">No partial writes were left behind.</p>
      </div>
    </Card>
  );
}
