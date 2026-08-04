import type { Metadata } from "next";
import { ConfigProvider, theme as antTheme } from "antd";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Manrope, Unbounded } from "next/font/google";
import { headers } from "next/headers";

import { PublicSiteFrame } from "@/components/site/public-site-frame";

import "./globals.css";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "qiuaihub - QiuAI WorkOS 企业 AI 工作系统",
  description: "QiuAI WorkOS 面向企业提供数字员工、数字工厂、企业知识库、模型配置和 Windows 桌面端工作流。",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const initialLang = requestHeaders.get("x-site-lang") === "en" ? "en" : "zh";

  return (
    <html lang={initialLang === "en" ? "en" : "zh-CN"}>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <AntdRegistry>
          <ConfigProvider
            theme={{
              algorithm: antTheme.defaultAlgorithm,
              token: {
                colorPrimary: "#1f6f5b",
                colorInfo: "#1f6f5b",
                colorSuccess: "#1f8a5b",
                colorBgBase: "#f6f4ee",
                colorTextBase: "#151713",
                colorBorder: "rgba(21, 23, 19, 0.12)",
                borderRadius: 20,
                fontFamily: "var(--font-body), sans-serif",
              },
              components: {
                Typography: {
                  titleMarginBottom: 0,
                },
                Card: {
                  colorBorderSecondary: "rgba(21, 23, 19, 0.12)",
                },
                Button: {
                  controlHeightLG: 52,
                  fontWeight: 600,
                },
                Segmented: {
                  trackBg: "rgba(21, 23, 19, 0.06)",
                  itemColor: "rgba(21, 23, 19, 0.62)",
                  itemSelectedBg: "#ffffff",
                  itemSelectedColor: "#151713",
                },
              },
            }}
          >
            <PublicSiteFrame initialLang={initialLang}>{children}</PublicSiteFrame>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
