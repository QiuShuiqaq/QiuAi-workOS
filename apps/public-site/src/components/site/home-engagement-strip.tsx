"use client";

import { EyeOutlined, HeartFilled, LineChartOutlined } from "@ant-design/icons";
import { Button, Spin, Typography } from "antd";
import { useEffect, useRef, useState, useTransition } from "react";

import type { HomeEngagementStats, SiteLanguage } from "@/types/site";

const { Text } = Typography;

const EMPTY_STATS: HomeEngagementStats = {
  views: 0,
  likes: 0,
  trend: [],
  likedToday: false,
};

function buildTrendPath(values: number[]) {
  if (values.length <= 1) {
    return "";
  }

  const max = Math.max(...values, 1);
  const width = 180;
  const height = 52;
  const stepX = width / Math.max(values.length - 1, 1);

  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (value / max) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function formatTrendDates(stats: HomeEngagementStats) {
  if (!stats.trend.length) {
    return { start: "--", end: "--" };
  }

  return {
    start: stats.trend[0].date.slice(5),
    end: stats.trend[stats.trend.length - 1].date.slice(5),
  };
}

async function postStats(action: string) {
  const response = await fetch("/api/site-stats", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    throw new Error(`Failed to post stats: ${response.status}`);
  }

  return (await response.json()) as HomeEngagementStats;
}

export function HomeEngagementStrip({ lang }: { lang: SiteLanguage }) {
  const [stats, setStats] = useState<HomeEngagementStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const trackedViewRef = useRef(false);

  useEffect(() => {
    if (trackedViewRef.current) {
      return;
    }

    trackedViewRef.current = true;

    void postStats("home:view")
      .then((payload) => {
        setStats(payload);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const trendValues = stats.trend.map((item) => item.value);
  const trendPath = buildTrendPath(trendValues);
  const trendDates = formatTrendDates(stats);

  return (
    <div className="home-engagement-strip">
      <button
        type="button"
        className={`home-engagement-card home-engagement-card--like${stats.likedToday ? " home-engagement-card--liked" : ""}`}
        disabled={loading || isPending || stats.likedToday}
        onClick={() => {
          startTransition(() => {
            void postStats("home:like").then((payload) => {
              setStats(payload);
            });
          });
        }}
      >
        <div className="home-engagement-card__icon">
          <HeartFilled />
        </div>
        <div className="home-engagement-card__copy">
          <Text strong>{lang === "zh" ? "爱心" : "Likes"}</Text>
          <Text className="home-engagement-card__value">{stats.likes}</Text>
          <Text className="home-engagement-card__hint">
            {lang === "zh" ? "喜欢就点个赞吧~OvO~" : "Drop a like if you enjoyed it."}
          </Text>
        </div>
      </button>

      <div className="home-engagement-card">
        <div className="home-engagement-card__icon">
          <EyeOutlined />
        </div>
        <div className="home-engagement-card__copy">
          <Text strong>{lang === "zh" ? "浏览" : "Views"}</Text>
          <Text className="home-engagement-card__value">{stats.views}</Text>
          <Text className="home-engagement-card__hint">
            {lang === "zh" ? "常来看看，说不定有惊喜呢" : "Come back often. You might spot something new."}
          </Text>
        </div>
      </div>

      <div className="home-engagement-card home-engagement-card--chart">
        <div className="home-engagement-card__icon">
          <LineChartOutlined />
        </div>
        <div className="home-engagement-card__copy home-engagement-card__copy--chart">
          <div className="home-engagement-card__chart-head">
            <Text strong>{lang === "zh" ? "访问趋势" : "View Trend"}</Text>
          </div>
          {loading ? (
            <div className="home-trend-chart home-trend-chart--loading">
              <Spin size="small" />
            </div>
          ) : (
            <div className="home-trend-chart">
              <svg viewBox="0 0 180 52" className="home-trend-chart__svg" aria-hidden="true">
                <path d="M 0 51.5 L 180 51.5" className="home-trend-chart__axis" />
                {trendPath ? <path d={trendPath} className="home-trend-chart__line" /> : null}
              </svg>
              <div className="home-trend-chart__labels">
                <span>{trendDates.start}</span>
                <span>{trendDates.end}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {isPending ? (
        <Button size="small" type="text" icon={<Spin size="small" />} className="home-engagement-strip__pending">
          {lang === "zh" ? "同步中" : "Syncing"}
        </Button>
      ) : null}
    </div>
  );
}
