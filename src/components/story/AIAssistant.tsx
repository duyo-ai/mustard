"use client";

/**
 * AIAssistant Component
 *
 * A chat-based AI assistant for refining story content.
 * Users can send messages to edit HOOK, BODY, and CTA sections interactively.
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/lib/duyo/types";

/* ─────────────────────────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────────────────────────── */

interface AIAssistantProps {
  hookContent: string;
  bodyContent: string;
  ctaContent: string;
  onContentUpdate: (updates: {
    hook?: string;
    body?: string;
    cta?: string;
  }) => void;
  className?: string;
}

interface ChatMessage extends ConversationMessage {
  id: string;
  timestamp: Date;
  parsed?: {
    hook?: string;
    body?: string;
    cta?: string;
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Quick Action Buttons
 * ───────────────────────────────────────────────────────────────────────────── */

const QUICK_ACTIONS = [
  { label: "HOOK Regenerate", prompt: "HOOK을 더 자극적으로 다시 만들어줘" },
  { label: "Generate CTA", prompt: "CTA를 새로 만들어줘" },
  { label: "Change Tone", prompt: "전체 톤을 더 친근하게 바꿔줘" },
  { label: "Adjust Length", prompt: "BODY를 좀 더 짧게 줄여줘" },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * Component
 * ───────────────────────────────────────────────────────────────────────────── */

export function AIAssistant({
  hookContent,
  bodyContent,
  ctaContent,
  onContentUpdate,
  className,
}: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to bottom when new messages arrive */
  useEffect(() => {
    /*
     * Previous approach using scrollRef.scrollTop didn't work because
     * Radix UI's ScrollArea wraps content in an internal viewport element.
     * Using scrollIntoView on a marker element at the end is more reliable.
     */
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      /* Convert messages to conversation history format */
      const conversationHistory: ConversationMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/refine-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          hookContent,
          bodyContent,
          ctaContent,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        parsed: data.parsed,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      /* If the AI provided parsed content updates, apply them */
      if (data.parsed) {
        onContentUpdate(data.parsed);
      }
    } catch (error) {
      console.error("[AIAssistant] Error:", error);

      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "An error occurred. Please try again.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
        {/* Messages Area */}
        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                <p>Ask AI to help refine your story.</p>
                <p className="mt-1">e.g. &quot;Make the HOOK more engaging&quot;</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.parsed && (
                      <div className="mt-2 pt-2 border-t border-border/50 text-xs opacity-75">
                        Updated: {Object.keys(msg.parsed).join(", ")}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            {/* Scroll anchor - scrollIntoView targets this element */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => sendMessage(action.prompt)}
              disabled={isLoading}
            >
              {action.label}
            </Button>
          ))}
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter request..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;
