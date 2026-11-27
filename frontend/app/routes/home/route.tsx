import React from "react";
import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/route";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import {
  Search,
  Clock,
  ShieldCheck,
  MonitorCog,
  Palette,
  Cpu,
  Wifi,
  KeyRound,
  Bug,
  Image as ImageIcon,
  Megaphone,
  Sparkles,
  PenTool,
  CalendarClock,
  ArrowRight,
  LogIn,
  Zap,
  GitBranch,
  Activity,
} from "lucide-react";
import { PwaInstallButton } from "~/components/pwa-install-prompt";
import { publicAsset } from "~/utils/asset";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  return Response.json({});
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [trackId, setTrackId] = React.useState("");
  const [isTrackDialogOpen, setIsTrackDialogOpen] = React.useState(false);
  const navigate = useNavigate();

  const cleanTrackCode = trackId.trim().replace(/^#+/, "").trim();

  const handleTrackTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanTrackCode) {
      setIsTrackDialogOpen(false);
      navigate(`/ticket/${encodeURIComponent(cleanTrackCode)}`);
    }
  };

  const itScopes = [
    { icon: <Cpu size={14} aria-hidden="true" />, label: "Hardware & Devices" },
    { icon: <Wifi size={14} aria-hidden="true" />, label: "Network & Wi-Fi" },
    { icon: <KeyRound size={14} aria-hidden="true" />, label: "Accounts & Access" },
    { icon: <Bug size={14} aria-hidden="true" />, label: "Software & Bugs" },
  ];

  const corcomScopes = [
    { icon: <ImageIcon size={14} aria-hidden="true" />, label: "Posters & Banners" },
    { icon: <Megaphone size={14} aria-hidden="true" />, label: "Social & Campaigns" },
    { icon: <Sparkles size={14} aria-hidden="true" />, label: "Event Branding" },
    { icon: <PenTool size={14} aria-hidden="true" />, label: "Media & Layouts" },
  ];

  const workflowSteps = [
    {
      step: "STEP 01",
      icon: <GitBranch size={18} aria-hidden="true" />,
      title: "Pick Your Dedicated Team",
      description:
        "Route technical issues to IT Helpdesk (SLA-tracked) or creative briefs to Corcom (Deadline-scheduled).",
    },
    {
      step: "STEP 02",
      icon: <Zap size={18} aria-hidden="true" />,
      title: "Submit Without Login",
      description:
        "Fill out the tailored request form in seconds and get a unique Ticket ID (e.g. FIN-001) immediately.",
    },
    {
      step: "STEP 03",
      icon: <Activity size={18} aria-hidden="true" />,
      title: "Track Real-Time Progress",
      description:
        "Monitor ticket status, assigned specialist, and timeline updates anytime using your Ticket ID.",
    },
  ];

  return (
    <div className={styles.container}>
      {/* Top Navigation Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.brand}>
            <img
              src={publicAsset("logo/logo itani.png")}
              alt="Aero Nusantara Indonesia"
              width={32}
              height={32}
              className={styles.brandLogo}
            />
            <div className={styles.brandText}>
              <span className={styles.brandName}>Aero Nusantara</span>
              <span className={styles.brandTag}>Service Portal</span>
            </div>
          </div>

          <div className={styles.topBarActions}>
            <PwaInstallButton
              variant="outline"
              className={styles.installBtn}
              label="Get App"
            />
            <Link to="/login" className={styles.staffLoginLink}>
              <LogIn size={15} aria-hidden="true" />
              <span>Staff Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero + Dual Portal Selector */}
      <main className={styles.main}>
        <section className={styles.heroSection}>
          <div className={styles.heroHeader}>
            <div className={styles.eyebrow}>
              <ShieldCheck size={14} aria-hidden="true" />
              <span>Aero Nusantara Indonesia • Unified Request Desk</span>
            </div>
            <h1 className={styles.heroTitle}>
              Choose Your{" "}
              <span className={styles.heroTitleAccent}>Support Portal</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Two specialized teams, tailored workflows. Submit a technical IT issue or a
              Corcom creative request in seconds without an account.
            </p>

            <div className={styles.trackBar}>
              <button
                type="button"
                className={styles.trackTriggerBtn}
                onClick={() => setIsTrackDialogOpen(true)}
              >
                <Search size={16} aria-hidden="true" />
                Track Your Ticket
              </button>
              <span className={styles.trackHint}>
                Already submitted? Enter your Ticket ID (e.g. <code>FIN-001</code>)
              </span>
            </div>
          </div>

          {/* Side-by-Side Differentiated Portals */}
          <div className={styles.portalGrid}>
            {/* IT Support Portal Card */}
            <article className={`${styles.portalCard} ${styles.itCard}`}>
              <div className={styles.portalCardTop}>
                <div className={`${styles.portalIcon} ${styles.itIcon}`}>
                  <MonitorCog size={24} aria-hidden="true" />
                </div>
                <div className={styles.portalBadges}>
                  <span className={`${styles.teamBadge} ${styles.itBadge}`}>
                    IT SUPPORT
                  </span>
                  <span className={styles.modeTag}>
                    <Clock size={12} aria-hidden="true" />
                    SLA Monitored
                  </span>
                </div>
              </div>

              <div className={styles.portalBody}>
                <h2 className={styles.portalTitle}>Technical &amp; IT Helpdesk</h2>
                <p className={styles.portalDesc}>
                  Report hardware malfunctions, software errors, network disruptions, or
                  request system &amp; account access.
                </p>

                <ul className={styles.scopeGrid} aria-label="IT Support scopes">
                  {itScopes.map((item) => (
                    <li key={item.label} className={`${styles.scopeChip} ${styles.itChip}`}>
                      {item.icon}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.portalFooter}>
                <div className={styles.workflowMeta}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Handling</span>
                    <span className={styles.metaValue}>Priority &amp; Working-Hours SLA</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Best for</span>
                    <span className={styles.metaValue}>Urgent fixes, devices &amp; access</span>
                  </div>
                </div>

                <Link to="/submit-ticket" className={styles.itCta}>
                  <MonitorCog size={18} aria-hidden="true" />
                  Request IT
                  <ArrowRight size={17} className={styles.ctaArrow} aria-hidden="true" />
                </Link>
              </div>
            </article>

            {/* CORCOM Portal Card */}
            <article className={`${styles.portalCard} ${styles.cocCard}`}>
              <div className={styles.portalCardTop}>
                <div className={`${styles.portalIcon} ${styles.cocIcon}`}>
                  <Palette size={24} aria-hidden="true" />
                </div>
                <div className={styles.portalBadges}>
                  <span className={`${styles.teamBadge} ${styles.cocBadge}`}>
                    CORCOM
                  </span>
                  <span className={styles.modeTag}>
                    <CalendarClock size={12} aria-hidden="true" />
                    Deadline-Driven
                  </span>
                </div>
              </div>

              <div className={styles.portalBody}>
                <h2 className={styles.portalTitle}>Creative &amp; Corporate Comm</h2>
                <p className={styles.portalDesc}>
                  Request graphic design, event collaterals, social media visuals, banners,
                  and corporate publication assets.
                </p>

                <ul className={styles.scopeGrid} aria-label="Corcom scopes">
                  {corcomScopes.map((item) => (
                    <li key={item.label} className={`${styles.scopeChip} ${styles.cocChip}`}>
                      {item.icon}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.portalFooter}>
                <div className={styles.workflowMeta}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Schedule</span>
                    <span className={styles.metaValue}>Custom Target Deadline (WIB)</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Tracked on</span>
                    <span className={styles.metaValue}>Graphic Design Release Calendar</span>
                  </div>
                </div>

                <Link to="/corcom/submit-ticket" className={styles.cocCta}>
                  <Palette size={18} aria-hidden="true" />
                  Request Corcom
                  <ArrowRight size={17} className={styles.ctaArrow} aria-hidden="true" />
                </Link>
              </div>
            </article>
          </div>
        </section>

        {/* How It Works Strip */}
        <section className={styles.workflowSection} aria-label="How it works">
          <div className={styles.workflowGrid}>
            {workflowSteps.map((item) => (
              <div key={item.step} className={styles.workflowCard}>
                <div className={styles.workflowTop}>
                  <div className={styles.workflowIcon}>{item.icon}</div>
                  <span className={styles.workflowStep}>{item.step}</span>
                </div>
                <h3 className={styles.workflowTitle}>{item.title}</h3>
                <p className={styles.workflowDesc}>{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLeft}>
            <span className={styles.footerBrand}>Aero Nusantara Indonesia</span>
            <span className={styles.footerDivider}>•</span>
            <span className={styles.footerText}>
              © 2026 IT &amp; Corcom Service Desk. All rights reserved.
            </span>
          </div>
          <div className={styles.footerLinks}>
            <button
              type="button"
              className={styles.footerAction}
              onClick={() => setIsTrackDialogOpen(true)}
            >
              Track Ticket
            </button>
            <Link to="/login" className={styles.footerLink}>
              Staff Portal
            </Link>
          </div>
        </div>
      </footer>

      {/* Track Ticket Dialog */}
      <Dialog open={isTrackDialogOpen} onOpenChange={setIsTrackDialogOpen}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle className={styles.dialogTitle}>
              <Search size={18} aria-hidden="true" />
              Track Your Ticket
            </DialogTitle>
            <DialogDescription className={styles.dialogDescription}>
              Enter the Ticket ID you received after submitting an IT or Corcom request.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTrackTicket} className={styles.dialogForm}>
            <div className={styles.formGroup}>
              <Label htmlFor="ticket-id" className={styles.label}>
                Ticket ID
              </Label>
              <Input
                id="ticket-id"
                placeholder="e.g. FIN-001"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                className={styles.input}
                autoFocus
              />
              <p className={styles.inputHint}>
                Works for both IT Support and Corcom ticket codes.
              </p>
            </div>
            <DialogFooter className={styles.dialogFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTrackDialogOpen(false)}
                className={styles.cancelButton}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!cleanTrackCode} className={styles.trackButton}>
                Track Ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
