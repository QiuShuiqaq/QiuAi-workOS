"use client";

import type { SiteFooterContact } from "@/types/site";

function FooterLink({ contact }: { contact: SiteFooterContact }) {
  if (contact.href) {
    return (
      <a href={contact.href} target={contact.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
        {contact.label}
        {contact.value && contact.value !== contact.label ? `: ${contact.value}` : ""}
      </a>
    );
  }

  return (
    <span>
      {contact.label}
      {contact.value && contact.value !== contact.label ? `: ${contact.value}` : ""}
    </span>
  );
}

export function SiteFooterCard({
  siteName,
  contacts,
  footerLinks,
  footerLabels,
  beianText,
  beianUrl,
  publicSecurityBeianText,
  publicSecurityBeianUrl,
}: {
  siteName: string;
  title: string;
  description: string;
  contacts: SiteFooterContact[];
  footerLinks?: SiteFooterContact[];
  footerLabels?: {
    contact: string;
    resources: string;
    filing: string;
  };
  beianText: string;
  beianUrl?: string;
  publicSecurityBeianText?: string;
  publicSecurityBeianUrl?: string;
}) {
  return (
    <footer className="site-footer-card">
      <div className="site-footer-card__content">
        <div className="site-footer-card__column">
          <h3>{footerLabels?.contact ?? "Contact"}</h3>
          {contacts.map((contact) => (
            <FooterLink key={`${contact.label}-${contact.value}`} contact={contact} />
          ))}
        </div>

        {footerLinks?.length ? (
          <div className="site-footer-card__column">
            <h3>{footerLabels?.resources ?? "Resources"}</h3>
            {footerLinks.map((item) => (
              <FooterLink key={`${item.label}-${item.value}`} contact={item} />
            ))}
          </div>
        ) : null}

        <div className="site-footer-card__column">
          <h3>{footerLabels?.filing ?? "Filing"}</h3>
          {beianUrl ? (
            <a href={beianUrl} target="_blank" rel="noreferrer">
              {beianText}
            </a>
          ) : (
            <span>{beianText}</span>
          )}
          {publicSecurityBeianText ? (
            publicSecurityBeianUrl ? (
              <a href={publicSecurityBeianUrl} target="_blank" rel="noreferrer">
                {publicSecurityBeianText}
              </a>
            ) : (
              <span>{publicSecurityBeianText}</span>
            )
          ) : null}
        </div>
      </div>
      <div className="site-footer-card__bottom">© 2026 {siteName}. All rights reserved.</div>
    </footer>
  );
}
