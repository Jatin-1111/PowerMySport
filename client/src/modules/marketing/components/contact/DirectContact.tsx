import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { WHATSAPP_OPENERS } from "@powermysport/shared-types";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { ArrowUpRight, Instagram, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/**
 * The other ways to reach the team, as one panel instead of five boxes.
 *
 * Five bordered cards, a stock photo and a second copy of the opening hours made this
 * column taller than the form beside it and left a blank under the form. A single tinted
 * panel with ruled rows says the same things in about half the height, states the hours
 * once, and holds still beside the form on a wide screen.
 *
 * WhatsApp leads because it is where the rest of the site sends a parent first.
 */

type RowIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

const ROW =
  "group -mx-3 flex items-center gap-4 rounded-lg px-3 py-4 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

function Row({
  icon: Icon,
  label,
  children,
  href,
  external = false,
  iconClass = "text-ink",
}: {
  icon: RowIcon;
  label: string;
  children: ReactNode;
  href?: string;
  external?: boolean;
  iconClass?: string;
}) {
  const body = (
    <>
      <span className="border-hairline flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white">
        <Icon className={`h-5 w-5 ${iconClass}`} strokeWidth={1.5} />
      </span>
      <span className="min-w-0">
        <span className="text-ink-muted block text-sm">{label}</span>
        <span className="text-ink block break-words font-medium">{children}</span>
      </span>
      {href && (
        <ArrowUpRight
          aria-hidden
          strokeWidth={1.5}
          className="text-ink-muted ml-auto h-5 w-5 shrink-0 -translate-x-1 translate-y-1 opacity-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none"
        />
      )}
    </>
  );

  if (!href) return <li className={ROW}>{body}</li>;
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`${ROW} focus-visible:ring-ink hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2`}
      >
        {body}
      </a>
    </li>
  );
}

export function DirectContact() {
  return (
    <aside
      aria-labelledby="direct-contact"
      className="border-hairline bg-paper-deep/60 rounded-xl border p-6 sm:p-8 lg:sticky lg:top-28"
    >
      <h2 id="direct-contact" className="font-editorial text-ink text-3xl font-light">
        Prefer to talk?
      </h2>
      <p className="text-ink-body mt-1">Mon to Sat, 9 AM to 8 PM IST</p>

      <ul className="divide-hairline mt-4 divide-y">
        <Row
          icon={WhatsAppIcon}
          iconClass="text-green-700"
          label="WhatsApp"
          href={buildWhatsAppUrl(WHATSAPP_OPENERS.haveAQuestion)}
          external
        >
          Chat with us
        </Row>
        <Row icon={Mail} label="Email" href="mailto:teams@powermysport.com">
          teams@powermysport.com
        </Row>
        <Row icon={Phone} label="Phone" href="tel:+918968582443">
          +91 89685 82443
        </Row>
        <Row icon={MapPin} label="Office">
          Powermysport PVT. LTD., Mullanpur, Punjab
        </Row>
        <Row
          icon={Instagram}
          label="Instagram"
          href="https://www.instagram.com/powermysport"
          external
        >
          @powermysport
        </Row>
        <Row
          icon={Linkedin}
          label="LinkedIn"
          href="https://www.linkedin.com/company/powermysport-pvt-ltd/"
          external
        >
          PowerMySport Pvt Ltd
        </Row>
      </ul>
    </aside>
  );
}
