import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, Card } from "@heroui/react";
import apiDocsMarkdown from "../docs/api-docs.md?raw";

type CopyState = "idle" | "copied" | "failed";

export function ApiDocsPage() {
  return (
    <PanelLike
      title="接口文档"
      description="后台专用 Markdown 接口文档，包含常用接口、参数说明和可复制示例。"
      action={<CopyButton value={apiDocsMarkdown} idleLabel="复制全文" />}
    >
      <article className="api-docs">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ children }) => (
              <div className="api-docs-table">
                <table>{children}</table>
              </div>
            ),
            pre: ({ children }) => (
              <CodeBlock value={extractText(children)}>
                {children}
              </CodeBlock>
            ),
          }}
        >
          {apiDocsMarkdown}
        </ReactMarkdown>
      </article>
    </PanelLike>
  );
}

function PanelLike(props: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="api-docs-card">
      <Card.Header className="items-start gap-3">
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <Card.Title className="text-2xl tracking-tight">{props.title}</Card.Title>
          {props.action && <div className="shrink-0">{props.action}</div>}
        </div>
        <Card.Description>{props.description}</Card.Description>
      </Card.Header>
      <Card.Content>
        {props.children}
      </Card.Content>
    </Card>
  );
}

function CodeBlock({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <div className="api-docs-code">
      <div className="api-docs-code__actions">
        <CopyButton value={value} size="sm" />
      </div>
      <pre>{children}</pre>
    </div>
  );
}

function CopyButton({ value, idleLabel = "复制", size }: { value: string; idleLabel?: string; size?: "sm" }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1500);
  }

  return (
    <Button size={size} variant="secondary" onPress={copyValue}>
      {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : idleLabel}
    </Button>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return extractText(node.props.children);
  return "";
}
