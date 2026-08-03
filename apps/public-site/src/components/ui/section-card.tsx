"use client";

import { Card, Typography } from "antd";
import type { ReactNode } from "react";

const { Text, Title } = Typography;

export function SectionCard({
  title,
  description,
  extra,
  className,
  children,
}: {
  title: string;
  description?: string;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={`site-panel admin-card ${className ?? ""}`.trim()}
      variant="borderless"
      styles={{
        body: {
          padding: 0,
        },
      }}
    >
      <div className="admin-card__body">
        <div className="admin-card__head">
          <div className="admin-card__head-copy">
            <Title level={3} style={{ margin: 0 }}>
              {title}
            </Title>
            {description ? <Text type="secondary">{description}</Text> : null}
          </div>
          {extra ? <div className="admin-card__head-extra">{extra}</div> : null}
        </div>
        <div className="admin-card__content">{children}</div>
      </div>
    </Card>
  );
}
