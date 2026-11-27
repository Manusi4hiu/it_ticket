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
import { Search, LogIn } from "lucide-react";
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

  return (
    <div className={styles.container}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.brand}>
            <img
              src={publicAsset("logo/logo itani.png")}
              alt="Aero Nusantara Indonesia"
              width={28}
              height={28}
              className={styles.brandLogo}
            />
            <span className={styles.brandName}>Aero Nusantara Indonesia</span>
          </div>

          <div className={styles.topBarActions}>
            <PwaInstallButton
              variant="ghost"
              className={styles.installBtn}
              label="Get App"
            />
            <Link to="/login" className={styles.staffLoginLink}>
              <LogIn size={14} aria-hidden="true" />
              <span>Staff Login</span>
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.pageShell}>
          <div className={styles.pageHeader}>
            <h1 className={styles.heroTitle}>Service Request Portal</h1>
            <p className={styles.heroSubtitle}>
              Choose the team that fits your request. No account is required to submit a ticket.
            </p>
          </div>

          <div className={styles.workspaceGrid}>
            {/* Left: Two Distinct Request Channels */}
            <div className={styles.channelsColumn}>
              {/* IT Support Channel */}
              <section className={styles.itBand} aria-labelledby="it-portal-title">
                <div className={styles.bandHeader}>
                  <span className={styles.itCode}>IT SUPPORT</span>
                  <span className={styles.bandSchedule}>Working-Hours SLA</span>
                </div>
                <h2 id="it-portal-title" className={styles.bandTitle}>
                  Technical &amp; System Helpdesk
                </h2>
                <p className={styles.bandDesc}>
                  For daily technical issues, hardware repairs, account access, and internal application bugs.
                </p>

                <div className={styles.itScopeRow}>
                  <span>Hardware &amp; Printers</span>
                  <span>Wi-Fi, VPN &amp; Email</span>
                  <span>Software &amp; System Access</span>
                </div>

                <div className={styles.bandActionRow}>
                  <Link to="/submit-ticket" className={styles.itCta}>
                    Request IT
                  </Link>
                  <span className={styles.bandNote}>Handled by priority queue</span>
                </div>
              </section>

              {/* Corcom Channel */}
              <section className={styles.cocBand} aria-labelledby="coc-portal-title">
                <div className={styles.bandHeader}>
                  <span className={styles.cocCode}>CORCOM</span>
                  <span className={styles.bandSchedule}>Release Calendar</span>
                </div>
                <h2 id="coc-portal-title" className={styles.bandTitle}>
                  Corporate Comm &amp; Design
                </h2>
                <p className={styles.bandDesc}>
                  For visual design, internal publications, event collaterals, and company communication assets.
                </p>

                <div className={styles.cocRequirement}>
                  <strong>Deadline (WIB) Required:</strong> Set your target completion date and time in the brief so it is scheduled on the release calendar.
                </div>

                <div className={styles.bandActionRow}>
                  <Link to="/corcom/submit-ticket" className={styles.cocCta}>
                    Request Corcom
                  </Link>
                  <span className={styles.bandNote}>Posters, banners, social media &amp; events</span>
                </div>
              </section>
            </div>

            {/* Right: Tracking & Workflow Comparison */}
            <aside className={styles.sideColumn}>
              <div className={styles.trackPanel}>
                <h2 className={styles.sideTitle}>Track Existing Ticket</h2>
                <p className={styles.sideDesc}>
                  Already submitted a request? Check current status and team updates using your ticket code.
                </p>
                <button
                  type="button"
                  className={styles.trackTriggerBtn}
                  onClick={() => setIsTrackDialogOpen(true)}
                >
                  <Search size={15} aria-hidden="true" />
                  Track Your Ticket
                </button>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <span className={styles.footerText}>
            © 2026 Aero Nusantara Indonesia
          </span>
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

      <Dialog open={isTrackDialogOpen} onOpenChange={setIsTrackDialogOpen}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle className={styles.dialogTitle}>
              <Search size={18} aria-hidden="true" />
              Track Your Ticket
            </DialogTitle>
            <DialogDescription className={styles.dialogDescription}>
              Enter the ticket code from your confirmation page or email (e.g. FIN-001).
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
