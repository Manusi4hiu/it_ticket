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
  TicketPlus,
  Search,
  Clock,
  Users,
  BarChart3,
  Shield,
  Headphones,
} from "lucide-react";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  return {};
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [trackId, setTrackId] = React.useState("");
  const [isTrackDialogOpen, setIsTrackDialogOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleTrackTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackId.trim()) {
      setIsTrackDialogOpen(false);
      navigate(`/ticket/${trackId.trim()}`);
    }
  };

  const features = [
    {
      icon: <TicketPlus size={32} />,
      title: "Easy Submission",
      description: "Submit support tickets in seconds without needing to create an account. Just provide your details and describe your issue.",
    },
    {
      icon: <Search size={32} />,
      title: "Real-Time Tracking",
      description: "Track your ticket status in real-time using your unique ticket code. Stay informed every step of the way.",
    },
    {
      icon: <Clock size={32} />,
      title: "SLA Monitoring",
      description: "Our system monitors service level agreements to ensure your issues are resolved within the promised timeframe.",
    },
    {
      icon: <Users size={32} />,
      title: "Expert Support",
      description: "Our dedicated IT team is ready to help with any technical issues. Staff login for expert assistance.",
      isLogin: true,
    },
    {
      icon: <BarChart3 size={32} />,
      title: "Analytics Dashboard",
      description: "Comprehensive analytics and reporting for management to track performance and identify trends.",
    },
    {
      icon: <Shield size={32} />,
      title: "Secure & Reliable",
      description: "Your data is protected with enterprise-grade security. We ensure confidentiality and data integrity.",
    },
  ];

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>IT Support Made Simple</h1>
          <p className={styles.heroSubtitle}>
            Submit, track, and manage IT support tickets with ease. Our streamlined
            ticketing system ensures your issues are resolved quickly and efficiently.
          </p>
          <div className={styles.heroCta}>
            <Link to="/submit-ticket">
              <Button className={styles.primaryButton}>
                <TicketPlus size={20} />
                Submit a Ticket
              </Button>
            </Link>
            <Button
              variant="outline"
              className={styles.secondaryButton}
              onClick={() => setIsTrackDialogOpen(true)}
            >
              <Search size={20} />
              Track Your Ticket
            </Button>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className={styles.heroDecoration}>
          <div className={styles.glowOrb1}></div>
          <div className={styles.glowOrb2}></div>
          <div className={styles.glowOrb3}></div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.featuresSection}>
        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div
              key={index}
              className={`${styles.featureCard} ${feature.isLogin ? styles.loginCard : ""}`}
              onClick={() => feature.isLogin && navigate("/login")}
              role={feature.isLogin ? "button" : undefined}
              tabIndex={feature.isLogin ? 0 : undefined}
              onKeyDown={(e) => {
                if (feature.isLogin && (e.key === "Enter" || e.key === " ")) {
                  navigate("/login");
                }
              }}
            >
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>

            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className={styles.statsSection}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>24/7</div>
            <div className={styles.statLabel}>Support Available</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>&lt;1hr</div>
            <div className={styles.statLabel}>Avg Response Time</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>99%</div>
            <div className={styles.statLabel}>SLA Compliance</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>500+</div>
            <div className={styles.statLabel}>Tickets Resolved</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <span>Aero Nusantara Indonesia</span>
          </div>
          <p className={styles.footerText}>
            © 2026 IT Department. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Track Ticket Dialog */}
      <Dialog open={isTrackDialogOpen} onOpenChange={setIsTrackDialogOpen}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle className={styles.dialogTitle}>
              <div className={styles.dialogIconWrapper}>
                <Search size={24} />
              </div>
              Track Your Ticket
            </DialogTitle>
            <DialogDescription className={styles.dialogDescription}>
              Enter the Ticket ID you received via email to check its current status.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTrackTicket} className={styles.dialogForm}>
            <div className={styles.formGroup}>
              <Label htmlFor="ticket-id" className={styles.label}>Ticket ID</Label>
              <Input
                id="ticket-id"
                placeholder="e.g. abc123-def456"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                className={styles.input}
                autoFocus
              />
              <p className={styles.inputHint}>
                You can find your ticket ID in the confirmation email we sent you.
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
              <Button type="submit" disabled={!trackId.trim()} className={styles.trackButton}>
                <Search size={16} />
                Track Ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
