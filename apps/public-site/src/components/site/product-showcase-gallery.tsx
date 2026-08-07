"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { SiteLanguage } from "@/types/site";

const PRODUCT_SCREENSHOTS = [
  {
    src: "/images/products/qiuai-workos/01.png",
    title: {
      zh: "AI 电商图片工厂",
      en: "AI Ecommerce Image Factory",
    },
    summary: {
      zh: "上传商品素材、设置产物参数，并在一个界面查看任务、模型状态、日志和批量图片结果。",
      en: "Upload product assets, set output parameters, and review tasks, model status, logs, and batch image results in one workspace.",
    },
  },
  {
    src: "/images/products/qiuai-workos/02.png",
    title: {
      zh: "产物直接预览",
      en: "Direct Output Preview",
    },
    summary: {
      zh: "任务完成后直接查看生成结果，并按需要保存图片，不必离开当前工作界面。",
      en: "Review generated results immediately and save images without leaving the current workspace.",
    },
  },
  {
    src: "/images/products/qiuai-workos/03.png",
    title: {
      zh: "数字市场",
      en: "Digital Marketplace",
    },
    summary: {
      zh: "按业务场景浏览、安装和配置数字员工与数字工厂，免费与企业权限清晰区分。",
      en: "Browse, install, and configure digital workers and factories with clear free and enterprise access levels.",
    },
  },
  {
    src: "/images/products/qiuai-workos/04.png",
    title: {
      zh: "统一模型配置",
      en: "Unified Model Configuration",
    },
    summary: {
      zh: "集中接入多个模型供应商，拉取可用模型，并为不同能力选择合适的调用模型。",
      en: "Connect multiple model providers, retrieve available models, and assign suitable models to each capability.",
    },
  },
  {
    src: "/images/products/qiuai-workos/05.png",
    title: {
      zh: "企业与本地知识库",
      en: "Enterprise and Local Knowledge",
    },
    summary: {
      zh: "同步企业知识库并结合本地 PDF，让数字员工和数字工厂在企业资料基础上工作。",
      en: "Combine synchronized enterprise knowledge with local PDFs so workers and factories can use company context.",
    },
  },
] as const;

function readText(value: { zh: string; en: string }, lang: SiteLanguage) {
  return lang === "zh" ? value.zh : value.en;
}

function wrapIndex(index: number) {
  return (index + PRODUCT_SCREENSHOTS.length) % PRODUCT_SCREENSHOTS.length;
}

export function ProductShowcaseGallery({ lang }: { lang: SiteLanguage }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const activeItem = PRODUCT_SCREENSHOTS[activeIndex];
  const isZh = lang === "zh";

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewOpen(false);
      } else if (event.key === "ArrowLeft") {
        setActiveIndex((index) => wrapIndex(index - 1));
      } else if (event.key === "ArrowRight") {
        setActiveIndex((index) => wrapIndex(index + 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewOpen]);

  function showPrevious() {
    setActiveIndex((index) => wrapIndex(index - 1));
  }

  function showNext() {
    setActiveIndex((index) => wrapIndex(index + 1));
  }

  return (
    <div className="product-showcase">
      <div className="product-section-heading">
        <span>{isZh ? "真实产品界面" : "Real product interface"}</span>
        <h2>{isZh ? "从配置到产物，都在一个工作系统中完成" : "From configuration to outputs in one work system"}</h2>
        <p>
          {isZh
            ? "查看 QiuAI WorkOS 桌面端的数字工厂、数字市场、模型配置和知识库界面。"
            : "Explore the QiuAI WorkOS desktop experience across factories, marketplace, model configuration, and knowledge."}
        </p>
      </div>

      <div className="product-gallery">
        <button
          className="product-gallery__stage"
          type="button"
          onClick={() => setPreviewOpen(true)}
          aria-label={isZh ? `放大查看：${readText(activeItem.title, lang)}` : `Enlarge: ${readText(activeItem.title, lang)}`}
        >
          <Image
            key={activeItem.src}
            src={activeItem.src}
            alt={readText(activeItem.title, lang)}
            width={1559}
            height={860}
            sizes="(max-width: 720px) 100vw, (max-width: 1280px) 92vw, 1200px"
            priority={activeIndex === 0}
          />
          <span className="product-gallery__expand" aria-hidden="true">
            ↗
          </span>
        </button>

        <div className="product-gallery__caption" aria-live="polite">
          <div>
            <strong>{readText(activeItem.title, lang)}</strong>
            <p>{readText(activeItem.summary, lang)}</p>
          </div>
          <div className="product-gallery__controls">
            <button type="button" onClick={showPrevious} aria-label={isZh ? "上一张产品截图" : "Previous screenshot"} title={isZh ? "上一张" : "Previous"}>
              ←
            </button>
            <span>
              {activeIndex + 1} / {PRODUCT_SCREENSHOTS.length}
            </span>
            <button type="button" onClick={showNext} aria-label={isZh ? "下一张产品截图" : "Next screenshot"} title={isZh ? "下一张" : "Next"}>
              →
            </button>
          </div>
        </div>

        <div className="product-gallery__thumbnails" aria-label={isZh ? "产品截图列表" : "Product screenshots"}>
          {PRODUCT_SCREENSHOTS.map((item, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={item.src}
                className={selected ? "is-active" : undefined}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-current={selected ? "true" : undefined}
                aria-label={`${index + 1}. ${readText(item.title, lang)}`}
              >
                <Image src={item.src} alt="" width={312} height={172} sizes="(max-width: 720px) 42vw, 220px" />
                <span>{readText(item.title, lang)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {previewOpen ? (
        <div
          className="product-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={readText(activeItem.title, lang)}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewOpen(false);
            }
          }}
        >
          <div className="product-lightbox__content">
            <button
              className="product-lightbox__close"
              type="button"
              onClick={() => setPreviewOpen(false)}
              aria-label={isZh ? "关闭大图预览" : "Close preview"}
              title={isZh ? "关闭" : "Close"}
            >
              ×
            </button>
            <Image
              src={activeItem.src}
              alt={readText(activeItem.title, lang)}
              width={1559}
              height={860}
              sizes="96vw"
              priority
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
