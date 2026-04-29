import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Card, Chip, Input, Label, ListBox, Select, Table, TextField } from "@heroui/react";
import "./styles.css";

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
  status: string;
  last_used_at?: string | null;
  created_at: string;
};

type TaskRecord = {
  id: string;
  type: string;
  status: string;
  api_key_id?: string | null;
  token_id?: string | null;
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

const tabs = ["tokens", "api-keys", "tasks", "alerts"] as const;
type Tab = (typeof tabs)[number];

const tabLabels: Record<Tab, string> = {
  tokens: "账号管理",
  "api-keys": "API Keys",
  tasks: "任务记录",
  alerts: "告警记录",
};

const columnLabels: Record<string, string> = {
  actions: "操作",
  api_key_id: "API Key 标识",
  created_at: "创建时间",
  error: "错误",
  failure_count: "失败次数",
  id: "任务标识",
  last_checked_at: "最近检查时间",
  last_error: "最近错误",
  last_used_at: "最近使用时间",
  name: "名称",
  region: "区域",
  sort_order: "排序",
  status: "状态",
  token_id: "账号标识",
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

const typeLabels: Record<string, string> = {
  alert: "告警",
  image: "图片",
  images: "图片",
  token_unhealthy: "账号异常",
  video: "视频",
  videos: "视频",
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
  const [activeTab, setActiveTab] = useState<Tab>("tokens");
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [status, setStatus] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [editingToken, setEditingToken] = useState<TokenRecord | null>(null);

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    "X-Admin-Key": adminKey,
  }), [adminKey]);

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`/admin/api${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `请求失败：${response.status}`);
    return body;
  }

  async function refresh() {
    if (adminKey) localStorage.setItem("adminKey", adminKey);
    setStatus("正在刷新数据...");
    try {
      const [tokenBody, keyBody, taskBody, alertBody] = await Promise.all([
        api<{ data: TokenRecord[] }>("/tokens"),
        api<{ data: ApiKeyRecord[] }>("/api-keys"),
        api<{ data: TaskRecord[] }>("/tasks"),
        api<{ data: AlertRecord[] }>("/alerts"),
      ]);
      setTokens(tokenBody.data);
      setApiKeys(keyBody.data);
      setTasks(taskBody.data);
      setAlerts(alertBody.data);
      setStatus("数据已更新");
    } catch (error: any) {
      setStatus(translateDisplayText(error.message));
    }
  }

  useEffect(() => {
    fetch("/admin/api/config")
      .then((response) => response.json())
      .then((config) => setAdminAuthDisabled(!!config.admin_auth_disabled))
      .catch(() => undefined)
      .finally(() => {
        refresh();
      });
  }, []);

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
    await refresh();
  }

  async function createApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = await api<{ secret: string }>("/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: form.get("name") }),
    });
    setNewSecret(body.secret);
    event.currentTarget.reset();
    await refresh();
  }

  async function resolveAlert(id: string) {
    await api(`/alerts/${id}/resolve`, { method: "POST", body: "{}" });
    await refresh();
  }

  async function updateTokenStatus(id: string, status: string) {
    await api(`/tokens/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    await refresh();
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
    await refresh();
  }

  async function deleteToken(id: string) {
    await api(`/tokens/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function revokeApiKey(id: string) {
    await api(`/api-keys/${id}`, { method: "DELETE" });
    await refresh();
  }

  const openAlerts = alerts.filter((alert) => alert.status === "open").length;
  const healthyTokens = tokens.filter((token) => token.status === "healthy" || token.status === "unchecked").length;
  const runningTasks = tasks.filter((task) => task.status === "queued" || task.status === "running").length;

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

        <Button className="justify-center" onPress={refresh}>
          刷新数据
        </Button>

        <nav className="grid gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab}
              className="justify-start px-4 text-sm"
              variant={activeTab === tab ? "secondary" : "ghost"}
              onPress={() => setActiveTab(tab)}
            >
              {tabLabels[tab]}
            </Button>
          ))}
        </nav>

        <Card className="mt-auto">
          <Card.Header className="gap-1">
            <Card.Description>状态</Card.Description>
            <Card.Title className="text-sm">{status || "等待刷新"}</Card.Title>
          </Card.Header>
        </Card>
      </aside>

      <section className="min-w-0 bg-background p-5 md:p-8">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Metric label="可用账号" value={healthyTokens} detail={`总计 ${tokens.length}`} />
          <Metric label="运行中任务" value={runningTasks} detail={`最近 ${tasks.length} 条`} />
          <Metric label="未处理告警" value={openAlerts} detail={`总计 ${alerts.length}`} />
        </div>

        {activeTab === "tokens" && (
          <Panel title="账号管理" description="健康账号会按排序值顺序轮询，未检查账号会参与首次分配。">
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
          <Panel title="API Keys" description="外部调用方只需要使用这里生成的 API Key。密钥只在创建时显示一次。">
            <form className="grid gap-3 md:grid-cols-[minmax(220px,360px)_auto]" onSubmit={createApiKey}>
              <HeroText name="name" label="调用方" placeholder="调用方名称" required />
              <Button className="self-end" type="submit">
                生成 API Key
              </Button>
            </form>

            {newSecret && (
              <Card variant="transparent">
                <Card.Content>
                  <p className="mb-2 text-sm text-muted">新密钥只显示一次，请立即保存。</p>
                  <code className="block overflow-auto rounded-2xl p-3 text-sm text-foreground">{newSecret}</code>
                </Card.Content>
              </Card>
            )}

            <DataTable
              ariaLabel="API Keys"
              rows={apiKeys}
              columns={["name", "status", "last_used_at", "created_at"]}
              renderActions={(apiKey) => (
                apiKey.status === "active"
                  ? <Button size="sm" variant="danger-soft" onPress={() => revokeApiKey(apiKey.id)}>吊销</Button>
                  : null
              )}
            />
          </Panel>
        )}

        {activeTab === "tasks" && (
          <Panel title="任务记录" description="最近 200 条外部提交任务，包含使用的 API Key 与账号。">
            <DataTable ariaLabel="任务记录" rows={tasks} columns={["id", "type", "status", "api_key_id", "token_id", "created_at", "updated_at", "error"]} />
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
                    <p className="mt-1 text-sm text-muted">{formatCell(alert.type, "type")} · {formatCell(alert.severity, "severity")} · {formatCell(alert.status, "status")}</p>
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

function Panel(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <Card.Header className="items-start gap-1">
        <Card.Title className="text-2xl tracking-tight">{props.title}</Card.Title>
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
  return <span className="block max-w-md truncate text-sm text-muted">{formatCell(value, column)}</span>;
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
  if (column === "type") return typeLabels[stringValue] || stringValue;
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
