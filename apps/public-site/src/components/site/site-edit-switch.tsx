"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import type { SiteLanguage } from "@/types/site";

async function readApiError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ? String(body.error.message) : `请求失败：${response.status}`;
}

export function SiteEditSwitch({ lang }: { lang: SiteLanguage }) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const goContentAdmin = () => {
    window.location.href = `/content-admin?${new URLSearchParams({ lang }).toString()}`;
  };

  const handleOpen = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/content-admin/session", { cache: "no-store" });
      const session = (await response.json()) as { configured: boolean; authenticated: boolean };
      if (!session.configured) {
        setError("服务端未配置管理员密码。");
        setOpen(true);
        return;
      }

      if (session.authenticated) {
        goContentAdmin();
        return;
      }

      setOpen(true);
    } catch {
      setError("无法读取管理员登录状态。");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!secret.trim()) {
      setError("请输入管理员密码。");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/content-admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      goContentAdmin();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "管理员密码验证失败。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="site-edit-switch" type="button" onClick={() => void handleOpen()} disabled={loading}>
        编辑
      </button>

      {open ? (
        <div className="site-edit-modal" role="dialog" aria-modal="true" aria-labelledby="site-edit-modal-title">
          <button className="site-edit-modal__backdrop" type="button" aria-label="关闭编辑登录" onClick={() => setOpen(false)} />
          <form className="site-edit-modal__panel" onSubmit={(event) => void handleSubmit(event)}>
            <div>
              <span>CONTENT ADMIN</span>
              <h2 id="site-edit-modal-title">输入管理员密码</h2>
              <p>验证后进入内容管理，可以维护项目、案例、开源、服务、团队和关于内容。</p>
            </div>
            <input type="text" name="username" autoComplete="username" value="content-admin" hidden readOnly />
            <label>
              管理员密码
              <input
                value={secret}
                type="password"
                autoComplete="current-password"
                placeholder="请输入安全码"
                onChange={(event) => setSecret(event.target.value)}
              />
            </label>
            {error ? <p className="site-edit-modal__error">{error}</p> : null}
            <div className="site-edit-modal__actions">
              <button type="button" onClick={() => setOpen(false)}>
                取消
              </button>
              <button type="submit" disabled={loading}>
                {loading ? "验证中" : "进入编辑"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
