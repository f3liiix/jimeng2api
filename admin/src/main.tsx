import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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
    if (!response.ok) throw new Error(body?.error?.message || `Request failed: ${response.status}`);
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
      setStatus(error.message);
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

  return (
    <main className="shell">
      <aside className="side">
        <div>
          <p className="eyebrow">Jimeng2API</p>
          <h1>Admin Control</h1>
          <p className="muted">管理托管 token、API Key、任务状态和失效告警。</p>
        </div>
        {!adminAuthDisabled && (
          <label className="field">
            Admin Key
            <input value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="ADMIN_API_KEY" />
          </label>
        )}
        <button className="primary" onClick={refresh}>刷新</button>
        <nav>
          {tabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>
        <p className="status">{status}</p>
      </aside>

      <section className="workspace">
        {activeTab === "tokens" && (
          <Panel title="Managed Tokens" description="健康 token 会按 sort order 顺序轮询，unchecked 会参与首次分配。">
            <form className="inlineForm" onSubmit={createToken}>
              <input name="name" placeholder="名称" required />
              <input name="token" placeholder="sessionid" required />
              <select name="region" defaultValue="cn">
                <option value="cn">cn</option>
                <option value="us">us</option>
                <option value="hk">hk</option>
                <option value="jp">jp</option>
                <option value="sg">sg</option>
              </select>
              <input name="proxy_url" placeholder="代理 URL，可选" />
              <input name="sort_order" placeholder="排序" type="number" defaultValue="0" />
              <button className="primary">新增 Token</button>
            </form>
            {editingToken && (
              <form className="inlineForm editForm" onSubmit={updateTokenDetails}>
                <input name="name" defaultValue={editingToken.name} required />
                <input name="token" placeholder="新的 sessionid，留空则不替换" />
                <select name="region" defaultValue={editingToken.region}>
                  <option value="cn">cn</option>
                  <option value="us">us</option>
                  <option value="hk">hk</option>
                  <option value="jp">jp</option>
                  <option value="sg">sg</option>
                </select>
                <input name="proxy_url" defaultValue={editingToken.proxy_url || ""} placeholder="代理 URL，可选" />
                <input name="sort_order" type="number" defaultValue={editingToken.sort_order} />
                <button className="primary">保存修改</button>
                <button type="button" onClick={() => setEditingToken(null)}>取消</button>
              </form>
            )}
            <DataTable
              rows={tokens}
              columns={["name", "region", "status", "sort_order", "failure_count", "last_checked_at", "last_error"]}
              renderActions={(token) => (
                <div className="rowActions">
                  <button onClick={() => updateTokenStatus(token.id, token.status === "disabled" ? "unchecked" : "disabled")}>
                    {token.status === "disabled" ? "启用" : "停用"}
                  </button>
                  <button onClick={() => setEditingToken(token as TokenRecord)}>编辑</button>
                  <button onClick={() => deleteToken(token.id)}>删除</button>
                </div>
              )}
            />
          </Panel>
        )}

        {activeTab === "api-keys" && (
          <Panel title="API Keys" description="外部调用方只需要使用这里生成的 API Key。密钥只在创建时显示一次。">
            <form className="inlineForm" onSubmit={createApiKey}>
              <input name="name" placeholder="调用方名称" required />
              <button className="primary">生成 API Key</button>
            </form>
            {newSecret && <pre className="secret">{newSecret}</pre>}
            <DataTable
              rows={apiKeys}
              columns={["name", "status", "last_used_at", "created_at"]}
              renderActions={(apiKey) => (
                apiKey.status === "active"
                  ? <button onClick={() => revokeApiKey(apiKey.id)}>吊销</button>
                  : null
              )}
            />
          </Panel>
        )}

        {activeTab === "tasks" && (
          <Panel title="Tasks" description="最近 200 条外部提交任务，包含使用的 API Key 与托管 token。">
            <DataTable rows={tasks} columns={["id", "type", "status", "api_key_id", "token_id", "created_at", "updated_at", "error"]} />
          </Panel>
        )}

        {activeTab === "alerts" && (
          <Panel title="Alerts" description="Token 健康检查产生的未处理或已处理告警。">
            <div className="alertList">
              {alerts.map((alert) => (
                <article key={alert.id} className="alert">
                  <div>
                    <strong>{alert.message}</strong>
                    <p>{alert.type} · {alert.severity} · {alert.status}</p>
                  </div>
                  {alert.status === "open" && <button onClick={() => resolveAlert(alert.id)}>标记解决</button>}
                </article>
              ))}
            </div>
          </Panel>
        )}
      </section>
    </main>
  );
}

function Panel(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <header>
        <p className="eyebrow">Workspace</p>
        <h2>{props.title}</h2>
        <p className="muted">{props.description}</p>
      </header>
      {props.children}
    </section>
  );
}

function DataTable({
  rows,
  columns,
  renderActions,
}: {
  rows: Record<string, any>[];
  columns: string[];
  renderActions?: (row: Record<string, any>) => React.ReactNode;
}) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
            {renderActions && <th>actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map((column) => (
                <td key={column}>{formatCell(row[column])}</td>
              ))}
              {renderActions && <td>{renderActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

createRoot(document.getElementById("root")!).render(<App />);
