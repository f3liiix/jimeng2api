import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Card, Chip, Input, Label, ListBox, Select, Table, TextField } from "@heroui/react";
import "./styles.css";
import {
  ACCOUNT_REFRESH_INTERVAL_MS,
  adminRoutePaths,
  adminRoutes,
  displayTypeLabels,
  getAdminRouteFromPathname,
  getTaskRefreshIntervalMs,
  mergeCreatedApiKey,
  taskTableColumns,
  type AdminRoute,
} from "./refresh.ts";

type TokenRecord = {
  id: string;
  name: string;
  region: string;
  proxy_url?: string | null;
  status: string;
  sort_order: number;
  last_checked_at?: string | null;
  last_error?: string | null;
  failure_count: number;
};

type ApiKeyRecord = {
  id: string;
  name: string;
  api_key?: string | null;
  status: string;
  last_used_at?: string | null;
  created_at: string;
};

type TaskRecord = {
  id: string;
  type: string;
  status: string;
  api_key_id?: string | null;
  api_key_name?: string | null;
  token_id?: string | null;
  token_name?: string | null;
  created_at: string;
  updated_at: string;
  error?: unknown;
};

type AlertRecord = {
  id: string;
  type: string;
  severity: string;
  token_id?: string | null;
  message: string;
  status: string;
  created_at: string;
};

const tabLabels: Record<AdminRoute, string> = {
  tokens: "账号管理",
  "api-keys": "API Keys",
  tasks: "任务记录",
  alerts: "告警记录",
};

const columnLabels: Record<string, string> = {
  actions: "操作",
  api_key: "API Key",
  api_key_id: "调用方",
  api_key_name: "调用方",
  created_at: "创建时间",
  error: "错误",
  failure_count: "失败次数",
  id: "任务ID",
  last_checked_at: "最近检查时间",
  last_error: "最近错误",
  last_used_at: "最近使用时间",
  name: "名称",
  region: "区域",
  sort_order: "排序",
  status: "状态",
  token_id: "账号",
  token_name: "账号",
  type: "类型",
  updated_at: "更新时间",
};

const statusLabels: Record<string, string> = {
  active: "已启用",
  disabled: "已停用",
  failed: "失败",
  healthy: "健康",
  open: "未处理",
  queued: "排队中",
  resolved: "已处理",
  revoked: "已吊销",
  running: "运行中",
  succeeded: "成功",
  unchecked: "未检查",
  unhealthy: "异常",
};

const regionLabels: Record<string, string> = {
  cn: "中国",
  hk: "香港",
  jp: "日本",
  sg: "新加坡",
  us: "美国",
};

const severityLabels: Record<string, string> = {
  critical: "严重",
  error: "错误",
  high: "高",
  info: "提示",
  low: "低",
  medium: "中",
  warning: "警告",
};

const timeColumns = new Set(["created_at", "updated_at", "last_checked_at", "last_used_at"]);

function App() {
  const [adminKey, setAdminKey] = useState(localStorage.getItem("adminKey") || "");
  const [adminAuthDisabled, setAdminAuthDisabled] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminRoute>(() => getAdminRouteFromPathname(window.location.pathname));
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [newSecret, setNewSecret] = useState("");
  const [editingToken, setEditingToken] = useState<TokenRecord | null>(null);

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    "X-Admin-Key": adminKey,
  }), [adminKey]);

  const navigateTo = useCallback((route: AdminRoute) => {
    const path = adminRoutePaths[route];
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
    setActiveTab(route);
  }, []);

  const api = useCallback(async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`/admin/api${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `请求失败：${response.status}`);
    return body;
  }, [headers]);

  const loadTokens = useCallback(async () => {
    const body = await api<{ data: TokenRecord[] }>("/tokens");
    setTokens(body.data);
  }, [api]);

  const loadApiKeys = useCallback(async () => {
    const body = await api<{ data: ApiKeyRecord[] }>("/api-keys");
    setApiKeys(body.data);
  }, [api]);

  const loadTasks = useCallback(async () => {
    const body = await api<{ data: TaskRecord[] }>("/tasks");
    setTasks(body.data);
  }, [api]);

  const loadAlerts = useCallback(async () => {
    const body = await api<{ data: AlertRecord[] }>("/alerts");
    setAlerts(body.data);
  }, [api]);

  useEffect(() => {
    const normalizeCurrentPath = () => {
      const route = getAdminRouteFromPathname(window.location.pathname);
      const path = adminRoutePaths[route];
      if (window.location.pathname.replace(/\/+$/, "") !== path) {
        window.history.replaceState(null, "", path);
      }
      setActiveTab(route);
    };
    normalizeCurrentPath();
    window.addEventListener("popstate", normalizeCurrentPath);
    return () => window.removeEventListener("popstate", normalizeCurrentPath);
  }, []);

  useEffect(() => {
    if (adminKey) localStorage.setItem("adminKey", adminKey);
    else localStorage.removeItem("adminKey");
  }, [adminKey]);

  useEffect(() => {
    fetch("/admin/api/config")
      .then((response) => response.json())
      .then((config) => setAdminAuthDisabled(!!config.admin_auth_disabled))
      .catch(() => undefined)
  }, []);

  useEffect(() => {
    const loadPage = {
      tokens: loadTokens,
      "api-keys": loadApiKeys,
      tasks: loadTasks,
      alerts: loadAlerts,
    }[activeTab];
    loadPage().catch((error) => console.error(translateDisplayText(error.message)));
  }, [activeTab, loadAlerts, loadApiKeys, loadTasks, loadTokens]);

  useEffect(() => {
    if (activeTab !== "tokens") return undefined;
    const timer = window.setInterval(() => {
      loadTokens().catch((error) => console.error(translateDisplayText(error.message)));
    }, ACCOUNT_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeTab, loadTokens]);

  useEffect(() => {
    if (activeTab !== "tasks") return undefined;
    const timer = window.setInterval(() => {
      loadTasks().catch((error) => console.error(translateDisplayText(error.message)));
    }, getTaskRefreshIntervalMs(tasks));
    return () => window.clearInterval(timer);
  }, [activeTab, loadTasks, tasks]);

  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/tokens", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        token: form.get("token"),
        region: form.get("region"),
        proxy_url: form.get("proxy_url"),
        sort_order: Number(form.get("sort_order") || 0),
      }),
    });
    event.currentTarget.reset();
    await loadTokens();
  }

  async function createApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = await api<{ api_key: ApiKeyRecord; secret: string }>("/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: form.get("name") }),
    });
    setNewSecret(body.secret);
    setApiKeys((current) => mergeCreatedApiKey(current, { ...body.api_key, api_key: body.secret }));
    event.currentTarget.reset();
  }

  async function resolveAlert(id: string) {
    await api(`/alerts/${id}/resolve`, { method: "POST", body: "{}" });
    await loadAlerts();
  }

  async function updateTokenStatus(id: string, status: string) {
    await api(`/tokens/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    await loadTokens();
  }

  async function updateTokenDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingToken) return;
    const form = new FormData(event.currentTarget);
    const tokenValue = String(form.get("token") || "");
    await api(`/tokens/${editingToken.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: form.get("name"),
        ...(tokenValue ? { token: tokenValue } : {}),
        region: form.get("region"),
        proxy_url: form.get("proxy_url"),
        sort_order: Number(form.get("sort_order") || 0),
      }),
    });
    setEditingToken(null);
    await loadTokens();
  }

  async function deleteToken(id: string) {
    await api(`/tokens/${id}`, { method: "DELETE" });
    await loadTokens();
  }

  async function deleteApiKey(id: string) {
    await api(`/api-keys/${id}`, { method: "DELETE" });
    await loadApiKeys();
  }

  const pageMetrics = useMemo(() => {
    if (activeTab === "tokens") {
      return [
        { label: "可用账号", value: tokens.filter((token) => token.status === "healthy" || token.status === "unchecked").length, detail: `总计 ${tokens.length}` },
        { label: "异常账号", value: tokens.filter((token) => token.status === "unhealthy").length, detail: "需要处理" },
        { label: "停用账号", value: tokens.filter((token) => token.status === "disabled").length, detail: "不参与轮询" },
      ];
    }
    if (activeTab === "api-keys") {
      return [
        { label: "已启用", value: apiKeys.filter((apiKey) => apiKey.status === "active").length, detail: `总计 ${apiKeys.length}` },
        { label: "已吊销", value: apiKeys.filter((apiKey) => apiKey.status === "revoked").length, detail: "不可继续调用" },
        { label: "调用方", value: apiKeys.length, detail: "当前记录" },
      ];
    }
    if (activeTab === "tasks") {
      return [
        { label: "运行中任务", value: tasks.filter((task) => task.status === "queued" || task.status === "running").length, detail: `最近 ${tasks.length} 条` },
        { label: "成功任务", value: tasks.filter((task) => task.status === "succeeded").length, detail: "当前列表" },
        { label: "失败任务", value: tasks.filter((task) => task.status === "failed").length, detail: "当前列表" },
      ];
    }
    return [
      { label: "未处理告警", value: alerts.filter((alert) => alert.status === "open").length, detail: `总计 ${alerts.length}` },
      { label: "已处理告警", value: alerts.filter((alert) => alert.status === "resolved").length, detail: "当前列表" },
      { label: "告警记录", value: alerts.length, detail: "最近记录" },
    ];
  }, [activeTab, alerts, apiKeys, tasks, tokens]);

  return (
    <main className="grid min-h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-7 bg-surface-secondary border-b border-border p-6 lg:border-r lg:border-b-0 lg:p-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.24em] text-muted uppercase">Jimeng2API</p>
          <h1 className="text-4xl leading-none font-semibold tracking-tighter text-foreground">管理控制台</h1>
        </div>

        {!adminAuthDisabled && (
          <TextField name="adminKey" value={adminKey} onChange={setAdminKey}>
            <Label>管理密钥</Label>
            <Input placeholder="请输入管理密钥" />
          </TextField>
        )}

        <nav className="grid gap-2">
          {adminRoutes.map((tab) => (
            <Button
              key={tab}
              className="justify-start px-4 text-sm"
              variant={activeTab === tab ? "secondary" : "ghost"}
              onPress={() => navigateTo(tab)}
            >
              {tabLabels[tab]}
            </Button>
          ))}
        </nav>

      </aside>

      <section className="min-w-0 bg-background p-5 md:p-8">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {pageMetrics.map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
          ))}
        </div>

        {activeTab === "tokens" && (
          <Panel title="账号管理" description="健康账号会按排序值顺序轮询">
            <form className="grid gap-3 xl:grid-cols-[1fr_1fr_120px_1fr_120px_auto]" onSubmit={createToken}>
              <HeroText name="name" label="名称" placeholder="账号名称" required />
              <HeroText name="token" label="Session ID" placeholder="请输入 Session ID" required />
              <RegionSelect />
              <HeroText name="proxy_url" label="代理" placeholder="可选" />
              <HeroText name="sort_order" label="排序" type="number" defaultValue="0" />
              <Button className="self-end" type="submit">
                新增账号
              </Button>
            </form>

            {editingToken && (
              <Card variant="transparent">
                <Card.Content>
                <form className="grid gap-3 xl:grid-cols-[1fr_1fr_120px_1fr_120px_auto_auto]" onSubmit={updateTokenDetails}>
                  <HeroText name="name" label="名称" defaultValue={editingToken.name} required />
                  <HeroText name="token" label="替换 Session ID" placeholder="留空则不替换" />
                  <RegionSelect defaultValue={editingToken.region} />
                  <HeroText name="proxy_url" label="代理" defaultValue={editingToken.proxy_url || ""} />
                  <HeroText name="sort_order" label="排序" type="number" defaultValue={String(editingToken.sort_order)} />
                  <Button className="self-end" type="submit">
                    保存
                  </Button>
                  <Button className="self-end" variant="ghost" type="button" onPress={() => setEditingToken(null)}>
                    取消
                  </Button>
                </form>
                </Card.Content>
              </Card>
            )}

            <DataTable
              ariaLabel="账号管理"
              rows={tokens}
              columns={["name", "region", "status", "sort_order", "failure_count", "last_checked_at", "last_error"]}
              renderActions={(token) => (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onPress={() => updateTokenStatus(token.id, token.status === "disabled" ? "unchecked" : "disabled")}>
                    {token.status === "disabled" ? "启用" : "停用"}
                  </Button>
                  <Button size="sm" variant="secondary" onPress={() => setEditingToken(token as TokenRecord)}>编辑</Button>
                  <Button size="sm" variant="danger-soft" onPress={() => deleteToken(token.id)}>删除</Button>
                </div>
              )}
            />
          </Panel>
        )}

        {activeTab === "api-keys" && (
          <Panel title="API Keys" description="外部调用方只需要使用这里生成的 API Key，可在表格中查看并复制。">
            <form className="grid gap-3 md:grid-cols-[minmax(220px,360px)_auto]" onSubmit={createApiKey}>
              <HeroText name="name" label="调用方" placeholder="调用方名称" required />
              <Button className="self-end" type="submit">
                生成 API Key
              </Button>
            </form>

            {newSecret && (
              <Card variant="transparent">
                <Card.Content>
                  <p className="mb-2 text-sm text-muted">新密钥已生成，也可在下方表格中复制。</p>
                  <code className="block overflow-auto rounded-2xl p-3 text-sm text-foreground">{newSecret}</code>
                </Card.Content>
              </Card>
            )}

            <DataTable
              ariaLabel="API Keys"
              rows={apiKeys}
              columns={["name", "status", "api_key", "last_used_at", "created_at"]}
              renderActions={(apiKey) => (
                <Button size="sm" variant="danger-soft" onPress={() => deleteApiKey(apiKey.id)}>删除</Button>
              )}
            />
          </Panel>
        )}

        {activeTab === "tasks" && (
          <Panel
            title="任务记录"
            description="最近 200 条外部提交任务，包含调用方与账号"
            action={
              <Button size="sm" variant="secondary" onPress={() => loadTasks()}>
                刷新状态
              </Button>
            }
          >
            <DataTable ariaLabel="任务记录" rows={tasks} columns={taskTableColumns} />
          </Panel>
        )}

        {activeTab === "alerts" && (
          <Panel title="告警记录" description="账号健康检查产生的未处理或已处理告警。">
            <div className="grid gap-3">
              {alerts.map((alert) => (
                <Card key={alert.id} variant="transparent">
                  <Card.Content className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <strong className="text-foreground">{alert.message}</strong>
                    <p className="mt-1 text-sm text-muted">{formatCell(alert.type, "type")} · {formatCell(alert.severity, "severity")} · {formatCell(alert.status, "status")} · 发生时间：{formatCell(alert.created_at, "created_at")}</p>
                  </div>
                  {alert.status === "open" && (
                    <Button variant="danger-soft" onPress={() => resolveAlert(alert.id)}>
                      标记解决
                    </Button>
                  )}
                  </Card.Content>
                </Card>
              ))}
              {!alerts.length && <EmptyState message="暂无告警" />}
            </div>
          </Panel>
        )}
      </section>
    </main>
  );
}

function Panel(props: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <Card.Header className="items-start gap-3">
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <Card.Title className="text-2xl tracking-tight">{props.title}</Card.Title>
          {props.action && <div className="shrink-0">{props.action}</div>}
        </div>
        <Card.Description>{props.description}</Card.Description>
      </Card.Header>
      <Card.Content className="gap-6">
        {props.children}
      </Card.Content>
    </Card>
  );
}

function Metric(props: { label: string; value: number; detail: string }) {
  return (
    <Card>
      <Card.Header className="gap-1">
        <Card.Description>{props.label}</Card.Description>
        <Card.Title className="text-4xl tracking-tighter">{props.value}</Card.Title>
        <Card.Description>{props.detail}</Card.Description>
      </Card.Header>
    </Card>
  );
}

function HeroText(props: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <TextField isRequired={props.required} name={props.name} type={props.type} defaultValue={props.defaultValue} variant="secondary">
      <Label>{props.label}</Label>
      <Input name={props.name} placeholder={props.placeholder} />
    </TextField>
  );
}

function RegionSelect(props: { defaultValue?: string }) {
  return (
    <Select className="w-full" defaultValue={props.defaultValue || "cn"} name="region" placeholder="请选择区域" variant="secondary">
      <Label>区域</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {["cn", "us", "hk", "jp", "sg"].map((region) => (
            <ListBox.Item key={region} id={region} textValue={regionLabels[region]}>
              {regionLabels[region]}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function DataTable({
  rows,
  columns,
  ariaLabel,
  renderActions,
}: {
  rows: Record<string, any>[];
  columns: string[];
  ariaLabel: string;
  renderActions?: (row: Record<string, any>) => React.ReactNode;
}) {
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={ariaLabel} className="min-w-[840px]">
          <Table.Header>
            {columns.map((column, index) => (
              <Table.Column key={column} isRowHeader={index === 0}>
                {columnLabels[column] || column}
              </Table.Column>
            ))}
            {renderActions && <Table.Column>{columnLabels.actions}</Table.Column>}
          </Table.Header>
          <Table.Body>
            {rows.map((row, index) => (
              <Table.Row key={row.id || index} id={row.id || String(index)}>
                {columns.map((column) => (
                  <Table.Cell key={column}>{renderCell(column, row[column])}</Table.Cell>
                ))}
                {renderActions && <Table.Cell>{renderActions(row)}</Table.Cell>}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      {!rows.length && <Table.Footer><EmptyState message="暂无数据" /></Table.Footer>}
    </Table>
  );
}

function renderCell(column: string, value: unknown) {
  if (column === "status") {
    return <StatusChip status={String(value || "unknown")} />;
  }
  if (column === "api_key") {
    return <ApiKeyCell value={typeof value === "string" ? value : ""} />;
  }
  return <span className="block max-w-md truncate text-sm text-muted">{formatCell(value, column)}</span>;
}

function ApiKeyCell({ value }: { value: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  if (!value) {
    return <span className="text-sm text-muted">不可恢复</span>;
  }

  async function copyApiKey() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1500);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 1500);
    }
  }

  return (
    <div className="flex max-w-xl items-center gap-2">
      <code className="block min-w-0 flex-1 truncate text-sm text-foreground">{value}</code>
      <Button size="sm" variant="secondary" onPress={copyApiKey}>
        {copyStatus === "copied" ? "已复制" : copyStatus === "failed" ? "复制失败" : "复制"}
      </Button>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const color = status === "healthy" || status === "active" || status === "succeeded"
    ? "success"
    : status === "unhealthy" || status === "failed" || status === "revoked"
      ? "danger"
      : status === "disabled"
        ? "default"
        : "primary";

  return <Chip color={color as any} size="sm" variant="soft">{statusLabels[status] || status}</Chip>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card variant="transparent">
      <Card.Content className="text-center text-sm text-muted">{message}</Card.Content>
    </Card>
  );
}

function formatCell(value: unknown, column?: string) {
  if (value === null || value === undefined || value === "") return "—";
  const stringValue = String(value);
  if (column && timeColumns.has(column)) return formatBeijingTime(stringValue);
  if (column === "region") return regionLabels[stringValue] || stringValue;
  if (column === "status") return statusLabels[stringValue] || stringValue;
  if (column === "type") return displayTypeLabels[stringValue] || stringValue;
  if (column === "severity") return severityLabels[stringValue] || stringValue;
  if (typeof value === "object") return translateDisplayText(JSON.stringify(value));
  return translateDisplayText(stringValue);
}

function formatBeijingTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return translateDisplayText(value);

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function translateDisplayText(text: string) {
  return text
    .replaceAll("Admin Key", "管理密钥")
    .replaceAll("sessionid", "Session ID")
    .replaceAll("Token", "账号")
    .replaceAll("token", "账号");
}

createRoot(document.getElementById("root")!).render(<App />);
