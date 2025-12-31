"use client";

/* LLM Usage Bar - Always visible usage indicator with inline popover */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLLMUsage } from "@/context/LLMUsageContext";
import { formatTokens, formatCost } from "@/lib/llm/pricing";
import type { LLMUsageLog, LLMOperation } from "@/lib/core/types";

const OPERATION_LABELS: Record<LLMOperation, string> = {
  story_generation: "Story",
  split_scenes: "Split Scenes",
  image_analysis: "Image Analysis",
  image_placement: "Placement",
};

export function LLMUsageBar() {
  const { session, isLoading, activeOperation, exportAsJSON, clearLogs } =
    useLLMUsage();
  const [copiedToast, setCopiedToast] = useState(false);

  const { totals } = session;

  const handleCopy = useCallback(() => {
    const json = exportAsJSON();
    navigator.clipboard.writeText(json);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  }, [exportAsJSON]);

  const handleDownload = useCallback(() => {
    const json = exportAsJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llm-usage-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportAsJSON]);

  return (
    <div className="flex items-center gap-3">
      {/* Loading indicator */}
      {isLoading && (
        <Badge
          variant="outline"
          className="animate-pulse border-yellow-500 text-yellow-600"
        >
          {activeOperation?.replace("_", " ")}...
        </Badge>
      )}

      {/* Usage stats with popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 gap-2 font-mono text-xs"
          >
            <span className="text-muted-foreground">Tokens:</span>
            <span className="font-medium">{formatTokens(totals.tokens)}</span>
            <span className="text-muted-foreground mx-1">|</span>
            <span className="text-muted-foreground">Cost:</span>
            <span className="font-medium">{formatCost(totals.cost)}</span>
            <span className="text-muted-foreground mx-1">|</span>
            <span className="text-muted-foreground">Calls:</span>
            <span className="font-medium">{totals.calls}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[420px] p-0" align="end">
          {/* Header */}
          <div className="p-4 border-b">
            <h3 className="font-semibold">LLM Usage Details</h3>
            <p className="text-xs text-muted-foreground">
              Session started {new Date(session.startedAt).toLocaleTimeString()}
            </p>
          </div>

          {/* Summary Grid */}
          <div className="p-4 bg-muted/30">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-mono font-bold">
                  {formatTokens(totals.tokens)}
                </p>
                <p className="text-xs text-muted-foreground">tokens</p>
              </div>
              <div>
                <p className="text-xl font-mono font-bold">
                  {formatCost(totals.cost)}
                </p>
                <p className="text-xs text-muted-foreground">cost</p>
              </div>
              <div>
                <p className="text-xl font-mono font-bold">{totals.calls}</p>
                <p className="text-xs text-muted-foreground">calls</p>
              </div>
            </div>
          </div>

          {/* Log List */}
          <ScrollArea className="max-h-xl">
            <div className="p-2 space-y-1">
              {session.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No API calls yet
                </p>
              ) : (
                session.logs.map((log) => <LogItem key={log.id} log={log} />)
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="p-2 border-t flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={handleCopy}
            >
              {copiedToast ? "Copied!" : "Copy JSON"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={handleDownload}
            >
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={clearLogs}
              disabled={session.logs.length === 0}
            >
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* Compact Log Item */
function LogItem({ log }: { log: LLMUsageLog }) {
  const [isOpen, setIsOpen] = useState(false);

  const timestamp = new Date(log.timestamp);
  const timeStr = timestamp.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const latencyStr =
    log.latencyMs >= 1000
      ? `${(log.latencyMs / 1000).toFixed(1)}s`
      : `${log.latencyMs}ms`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={`
            px-3 py-2 rounded cursor-pointer text-xs
            transition-colors hover:bg-muted/50
            ${!log.success ? "bg-red-50" : ""}
          `}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {isOpen ? "v" : ">"}
              </span>
              <span className="font-medium">
                {OPERATION_LABELS[log.operation]}
              </span>
              {log.batchInfo && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  x{log.batchInfo.totalItems}
                </Badge>
              )}
            </div>
            <span className="font-mono text-muted-foreground">
              {formatCost(log.cost.total)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
            <span>{timeStr}</span>
            <span>-</span>
            <span>{latencyStr}</span>
            <span>-</span>
            <span>
              {formatTokens(log.tokens.input)}/{formatTokens(log.tokens.output)}
            </span>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mx-3 mb-2 p-2 bg-muted/30 rounded text-[10px] space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Model:</span>
            <span className="font-mono">{log.model}</span>
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-mono">{formatTokens(log.tokens.input)}</p>
              <p className="text-muted-foreground">in</p>
            </div>
            <div>
              <p className="font-mono">{formatTokens(log.tokens.output)}</p>
              <p className="text-muted-foreground">out</p>
            </div>
            <div>
              <p className="font-mono">{formatTokens(log.tokens.total)}</p>
              <p className="text-muted-foreground">total</p>
            </div>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Input cost:</span>
            <span className="font-mono">{formatCost(log.cost.input)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Output cost:</span>
            <span className="font-mono">{formatCost(log.cost.output)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total:</span>
            <span className="font-mono">{formatCost(log.cost.total)}</span>
          </div>

          {/* Batch details */}
          {log.batchInfo && log.batchInfo.itemLogs.length > 0 && (
            <>
              <Separator />
              <div className="max-h-20 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left">#</th>
                      <th className="text-right">in</th>
                      <th className="text-right">out</th>
                      <th className="text-right">ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.batchInfo.itemLogs.map((item) => (
                      <tr key={item.index}>
                        <td>{item.index}</td>
                        <td className="text-right font-mono">
                          {item.tokens.input}
                        </td>
                        <td className="text-right font-mono">
                          {item.tokens.output}
                        </td>
                        <td className="text-right font-mono">
                          {item.latencyMs}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
