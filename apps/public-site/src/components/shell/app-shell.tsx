"use client";

import Link from "next/link";
import { Layout, Typography } from "antd";
import type { ReactNode } from "react";

const { Header, Content } = Layout;
const { Text, Title } = Typography;

type ShellItem = {
  key?: string | null;
  label?: ReactNode;
  href?: string;
};

export function AppShell({
  title,
  subtitle,
  items,
  actions,
  children,
  variant = "default",
  selectedKeys,
  brandHref = "/",
}: {
  title: string;
  subtitle: string;
  items: ShellItem[];
  actions?: ReactNode;
  children: ReactNode;
  variant?: "default" | "public";
  selectedKeys?: string[];
  brandHref?: string;
}) {
  const activeKey = selectedKeys?.[0];

  return (
    <Layout
      className={`site-shell ${variant === "public" ? "public-site-shell" : ""}`}
      style={{ minHeight: "100vh", background: "transparent" }}
    >
      <Header
        className="site-shell__header site-shell__header--public"
        style={{ height: "auto", paddingInline: 0, background: "transparent" }}
      >
        <div className="site-shell__header-inner">
          <div className="site-shell__brand">
            <Link href={brandHref} className="site-shell__brand-link" translate="no">
              <Title level={4} style={{ margin: 0, color: "var(--foreground-strong)", fontSize: 24 }}>
                {title}
              </Title>
            </Link>
            <Text
              style={{
                color: variant === "public" ? "var(--muted)" : "var(--muted-strong)",
                fontSize: 13,
                letterSpacing: "0.04em",
              }}
            >
              {subtitle}
            </Text>
          </div>

          <nav className="site-shell__nav" aria-label="Primary">
            <div className="site-shell__nav-links">
              {items.map((item) => {
                const isActive = item.key === activeKey;
                return (
                  item.href ? (
                    <Link
                      key={item.key ?? String(item.label)}
                      href={item.href}
                      className={`site-shell__nav-link ${isActive ? "site-shell__nav-link--active" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <div
                      key={item.key ?? String(item.label)}
                      className={`site-shell__nav-link ${isActive ? "site-shell__nav-link--active" : ""}`}
                    >
                      {item.label}
                    </div>
                  )
                );
              })}
            </div>
          </nav>

          <div className="site-shell__actions">{actions}</div>
        </div>
      </Header>
      <Content className="site-shell__content site-shell__content--public">
        <div className="site-shell__content-inner">{children}</div>
      </Content>
    </Layout>
  );
}
