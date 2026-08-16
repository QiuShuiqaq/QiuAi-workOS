"use client";

import { useState } from "react";

import type { PublicPlan } from "@/modules/site/workos-plans";
import type { SiteLanguage } from "@/types/site";

type BillingPeriod = "MONTHLY" | "ANNUAL";

const PLAN_GROUPS = [
  {
    key: "FREE",
    monthlyCode: "PERSONAL_FREE",
    annualCode: "PERSONAL_FREE",
    name: { zh: "个人免费版", en: "Personal Free" },
    fitFor: { zh: "适合个人、工作室或企业初次体验。", en: "For individuals, studios, and first-time enterprise trials." },
    highlight: false,
  },
  {
    key: "MEMBER",
    monthlyCode: "PERSONAL_MEMBER_MONTHLY",
    annualCode: "PERSONAL_MEMBER_ANNUAL",
    name: { zh: "个人会员版", en: "Personal Member" },
    fitFor: {
      zh: "适合个人长期使用数字员工和数字工厂，支持购买 AI 点数。",
      en: "For individuals who want daily use of digital workers and factories, with AI points available.",
    },
    highlight: true,
  },
  {
    key: "BASIC",
    monthlyCode: "ENTERPRISE_BASIC_MONTHLY",
    annualCode: "ENTERPRISE_BASIC_ANNUAL",
    name: { zh: "企业基础版", en: "Enterprise Basic" },
    fitFor: { zh: "适合小团队试点数字员工和 AI 工作流，支持 10 台设备。", en: "For small teams piloting digital workers and AI workflows, with 10 devices." },
    highlight: false,
  },
  {
    key: "STANDARD",
    monthlyCode: "ENTERPRISE_STANDARD_MONTHLY",
    annualCode: "ENTERPRISE_STANDARD_ANNUAL",
    name: { zh: "企业标准版", en: "Enterprise Standard" },
    fitFor: { zh: "适合多个岗位正常使用数字员工和数字工厂，支持 30 台设备。", en: "For teams using workers and factories across roles, with 30 devices." },
    highlight: true,
  },
  {
    key: "PRO",
    monthlyCode: "ENTERPRISE_PRO_MONTHLY",
    annualCode: "ENTERPRISE_PRO_ANNUAL",
    name: { zh: "企业专业版", en: "Enterprise Professional" },
    fitFor: { zh: "适合高频生产和较大团队使用，支持 80 台设备。", en: "For high-frequency production and larger teams, with 80 devices." },
    highlight: false,
  },
] as const;

function readText(value: { zh: string; en: string }, lang: SiteLanguage) {
  return lang === "zh" ? value.zh : value.en;
}

function formatCurrency(amountCents: number, currency: string, lang: SiteLanguage) {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function entitlementValue(plan: PublicPlan | undefined, featureKey: string, lang: SiteLanguage) {
  const entitlement = plan?.entitlements.find((item) => item.featureKey === featureKey);
  if (!entitlement?.enabled) {
    return "0";
  }

  if (entitlement.limitValue === undefined) {
    return lang === "zh" ? "按需配置" : "Custom";
  }

  if (entitlement.limitValue >= 999999) {
    return lang === "zh" ? "不限" : "Unlimited";
  }

  return entitlement.limitValue.toLocaleString(lang === "zh" ? "zh-CN" : "en-US");
}

function isEnterpriseGroup(groupKey: string) {
  return groupKey === "BASIC" || groupKey === "STANDARD" || groupKey === "PRO";
}

function usageScopeText(groupKey: string, lang: SiteLanguage) {
  const zhText =
    {
      FREE: "基础体验",
      MEMBER: "个人使用",
      BASIC: "企业多设备",
      STANDARD: "企业多设备",
      PRO: "企业多设备",
    }[groupKey] ?? "按套餐开放";
  const enText =
    {
      FREE: "Basic trial",
      MEMBER: "Personal use",
      BASIC: "Enterprise devices",
      STANDARD: "Enterprise devices",
      PRO: "Enterprise devices",
    }[groupKey] ?? "Plan-based access";
  return lang === "zh" ? zhText : enText;
}

function aiPointAccessText(groupKey: string, lang: SiteLanguage) {
  const isZh = lang === "zh";
  if (groupKey === "MEMBER") {
    return isZh ? "含 1500 点/月" : "1,500 points/month";
  }

  if (isEnterpriseGroup(groupKey)) {
    return isZh ? "企业统一管理" : "Managed by company";
  }

  return isZh ? "支持单独购买" : "Top-up available";
}

function priceDetails(plan: PublicPlan | undefined, period: BillingPeriod, lang: SiteLanguage) {
  if (plan?.billingCycle === "FREE") {
    return {
      price: lang === "zh" ? "免费" : "Free",
      suffix: "",
      note: lang === "zh" ? "无需购买套餐" : "No subscription required",
    };
  }

  if (!plan?.priceCents) {
    return {
      price: lang === "zh" ? "待配置" : "Contact us",
      suffix: "",
      note: lang === "zh" ? "请前往购买中心查看" : "View the purchase center",
    };
  }

  const currency = plan.currency ?? "CNY";
  const baseNote =
    period === "ANNUAL"
      ? `${lang === "zh" ? "折合" : "Equivalent to"} ${formatCurrency(Math.round(plan.priceCents / 12), currency, lang)}${lang === "zh" ? "/月" : "/month"}`
      : lang === "zh"
        ? "按月支付"
        : "Billed monthly";

  if (period === "ANNUAL") {
    return {
      price: formatCurrency(plan.priceCents, currency, lang),
      suffix: lang === "zh" ? "/年" : "/year",
      note: baseNote,
    };
  }

  return {
    price: formatCurrency(plan.priceCents, currency, lang),
    suffix: lang === "zh" ? "/月" : "/month",
    note: baseNote,
  };
}

export function ProductPricing({
  plans,
  lang,
  consoleUrl,
}: {
  plans: PublicPlan[];
  lang: SiteLanguage;
  consoleUrl: string;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("MONTHLY");
  const isZh = lang === "zh";
  const normalizedConsoleUrl = consoleUrl.replace(/\/$/, "");
  const registerUrl = `${normalizedConsoleUrl}/register`;
  const purchaseUrl = `${normalizedConsoleUrl}/purchase`;
  const planMap = new Map(plans.map((plan) => [plan.code, plan]));

  if (!plans.length) {
    return (
      <div className="product-pricing">
        <div className="product-section-heading">
          <span>{isZh ? "套餐价格" : "Pricing"}</span>
          <h2>{isZh ? "选择适合你的使用方式" : "Choose the right way to use QiuAI WorkOS"}</h2>
        </div>
        <div className="product-pricing__fallback">
          <div>
            <strong>{isZh ? "套餐价格暂时无法获取" : "Pricing is temporarily unavailable"}</strong>
            <p>{isZh ? "你仍然可以进入企业购买中心查看最新套餐。" : "You can still view the latest plans in the enterprise purchase center."}</p>
          </div>
          <a href={purchaseUrl}>{isZh ? "前往购买中心" : "Open purchase center"} →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="product-pricing">
      <div className="product-pricing__header">
        <div className="product-section-heading product-section-heading--left">
          <span>{isZh ? "套餐价格" : "Pricing"}</span>
          <h2>{isZh ? "选择适合你的使用方式" : "Choose the right way to use QiuAI WorkOS"}</h2>
          <p>
            {isZh
              ? "个人免费、个人会员和企业套餐都支持购买 AI 点数；企业套餐容量会同步到企业绑定的每台 PC 设备。"
              : "Personal free, personal member, and enterprise plans can all buy AI points. Enterprise plan capacity applies to every bound PC device."}
          </p>
        </div>
        <div className="product-pricing__period" aria-label={isZh ? "选择付费周期" : "Select billing period"}>
          <button type="button" className={period === "MONTHLY" ? "is-active" : undefined} onClick={() => setPeriod("MONTHLY")} aria-pressed={period === "MONTHLY"}>
            {isZh ? "月付" : "Monthly"}
          </button>
          <button type="button" className={period === "ANNUAL" ? "is-active" : undefined} onClick={() => setPeriod("ANNUAL")} aria-pressed={period === "ANNUAL"}>
            {isZh ? "年付" : "Annual"}
          </button>
        </div>
      </div>

      <div className="product-pricing__grid">
        {PLAN_GROUPS.map((group) => {
          const planCode = period === "ANNUAL" ? group.annualCode : group.monthlyCode;
          const plan = planMap.get(planCode);
          const price = priceDetails(plan, period, lang);
          const isFree = group.key === "FREE";
          const isEnterprise = isEnterpriseGroup(group.key);
          const targetUrl = isFree ? registerUrl : purchaseUrl;

          return (
            <article key={group.key} className={`product-pricing-card${group.highlight ? " is-highlighted" : ""}`}>
              <div className="product-pricing-card__topline">
                <span>
                  {isFree ? (isZh ? "免费使用" : "Free") : group.key === "MEMBER" ? (isZh ? "个人会员" : "Member") : isZh ? "企业套餐" : "Enterprise"}
                </span>
                {group.highlight ? <strong>{isZh ? "推荐" : "Recommended"}</strong> : null}
              </div>
              <h3>{readText(group.name, lang)}</h3>
              <p className="product-pricing-card__fit">{readText(group.fitFor, lang)}</p>
              <div className="product-pricing-card__price">
                <strong>{price.price}</strong>
                {price.suffix ? <span>{price.suffix}</span> : null}
              </div>
              <p className="product-pricing-card__note">{price.note}</p>
              <dl>
                <div>
                  <dt>{isZh ? "可绑定设备" : "PC devices"}</dt>
                  <dd>{entitlementValue(plan, "maxDesktopDevices", lang)}</dd>
                </div>
                <div>
                  <dt>{isZh ? "使用范围" : "Scope"}</dt>
                  <dd>{usageScopeText(group.key, lang)}</dd>
                </div>
                <div>
                  <dt>{isZh ? "AI 点数" : "AI points"}</dt>
                  <dd>{aiPointAccessText(group.key, lang)}</dd>
                </div>
                {isEnterprise && period === "ANNUAL" ? (
                  <div>
                    <dt>{isZh ? "年付权益" : "Annual benefit"}</dt>
                    <dd>{isZh ? "可定制 1 个数字工厂" : "1 custom digital factory"}</dd>
                  </div>
                ) : null}
              </dl>
              <a className={group.highlight ? "is-primary" : undefined} href={targetUrl}>
                {isFree ? (isZh ? "免费注册" : "Register free") : isZh ? "前往购买中心" : "Open purchase center"}
                <span aria-hidden="true">→</span>
              </a>
            </article>
          );
        })}
      </div>

      <div className="product-pricing__custom">
        <div>
          <strong>{isZh ? "AI 点数说明" : "AI points"}</strong>
          <p>
            {isZh
              ? "文本 1 点，推理 3 点，图片 15 点起，视频 200 点起；100 点 = 1 元。个人会员月付包含 1500 点月度 AI 点数，当月未用完自动清零。"
              : "Text uses 1 point, reasoning uses 3 points, images start at 15 points, and video starts at 200 points; 100 points = 1 CNY. Monthly member plans include 1,500 monthly AI points that expire at the end of the month."}
          </p>
        </div>
        <a href={purchaseUrl}>{isZh ? "查看购买中心" : "Open purchase center"} →</a>
      </div>

      <div className="product-pricing__custom">
        <div>
          <strong>{isZh ? "企业定制与私有化部署" : "Enterprise customization and private deployment"}</strong>
          <p>{isZh ? "适合需要行业数字员工、专属数字工厂、系统集成或独立部署的企业。" : "For industry-specific workers, dedicated factories, integrations, or private deployment."}</p>
        </div>
        <a href={`/contact?lang=${lang}`}>{isZh ? "咨询企业方案" : "Contact enterprise services"} →</a>
      </div>

      <p className="product-pricing__footnote">
        {isZh
          ? "软件套餐与 AI 点数分开计费；月度点数到期清零，永久点数按 100 点 = 1 元长期有效。年付定制权益以运营方说明为准。"
          : "Software plans are billed separately from AI points; monthly points expire, while permanent points stay valid at 100 points = 1 CNY. Annual customization benefits follow operator policy."}
      </p>
    </div>
  );
}
