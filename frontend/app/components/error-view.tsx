import { useNavigate } from "react-router";
import { ShieldAlert, FileQuestion, AlertCircle, ArrowLeft, Home, LogIn } from "lucide-react";
import { Button } from "~/components/ui/button/button";
import styles from "~/styles/error-pages.module.css";

interface ErrorViewProps {
    code: string | number;
    title: string;
    message: string;
    type: "unauthorized" | "not-found" | "error";
}

export function ErrorView({ code, title, message, type }: ErrorViewProps) {
    const navigate = useNavigate();

    const getIcon = () => {
        switch (type) {
            case "unauthorized": return <ShieldAlert size={60} />;
            case "not-found": return <FileQuestion size={60} />;
            default: return <AlertCircle size={60} />;
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.illustration}>
                    <div className={styles.errorCode}>{code}</div>
                    <div className={styles.iconWrapper}>
                        {getIcon()}
                    </div>
                    <div className={styles.glow}></div>
                </div>

                <h1 className={styles.title}>{title}</h1>
                <p className={styles.message}>{message}</p>

                <div className={styles.actions}>
                    {type === "unauthorized" ? (
                        <Button className={styles.primaryButton} onClick={() => navigate("/login")}>
                            <LogIn style={{ width: "18px", height: "18px", marginRight: "8px" }} />
                            Login Now
                        </Button>
                    ) : (
                        <Button className={styles.primaryButton} onClick={() => navigate("/")}>
                            <Home style={{ width: "18px", height: "18px", marginRight: "8px" }} />
                            Back to Home
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        className={styles.secondaryButton}
                        onClick={() => {
                            if (type === "unauthorized") {
                                navigate("/");
                            } else {
                                navigate(-1);
                            }
                        }}
                    >
                        <ArrowLeft style={{ width: "18px", height: "18px", marginRight: "8px" }} />
                        {type === "unauthorized" ? "Back to Home" : "Go Back"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
