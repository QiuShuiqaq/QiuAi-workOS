import type { Metadata } from "next";
import Link from "next/link";

import { workosConsoleUrl } from "@/lib/site-data";

import "./globals.css";

export const metadata: Metadata = {
  title: "QiuAI WorkOS - 企业 AI 数字员工与数字工厂工作系统",
  description:
    "QiuAI WorkOS 面向企业提供 AI 数字员工、数字工厂、企业知识库、模型配置和 Windows 桌面端工作流。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="QiuAI WorkOS 首页">
            <span className="brand-mark">Q</span>
            <span>
              <strong>QiuAI WorkOS</strong>
              <small>Enterprise AI Work System</small>
            </span>
          </Link>
          <nav className="site-nav" aria-label="主导航">
            <Link href="/">产品</Link>
            <Link href="/downloads">下载</Link>
            <Link href="/docs">文档</Link>
            <a href={workosConsoleUrl}>企业控制台</a>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <div>
            <strong>QiuAI WorkOS</strong>
            <p>面向企业的 AI 数字员工与数字工厂工作系统。</p>
          </div>
          <div className="footer-links">
            <a href="mailto:3431752914@qq.com">3431752914@qq.com</a>
            <a
              href={
                process.env.NEXT_PUBLIC_ICP_BEIAN_URL ||
                "https://beian.miit.gov.cn/"
              }
              target="_blank"
              rel="noreferrer"
            >
              {process.env.NEXT_PUBLIC_ICP_BEIAN || "浙ICP备2026043969号-1"}
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
