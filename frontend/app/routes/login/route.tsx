import { LogIn, Shield, AlertCircle, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button/button";
import { Card } from "~/components/ui/card/card";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import { Alert } from "~/components/ui/alert/alert";
import { Form, redirect, Link } from "react-router";
import type { Route } from "./+types/route";
import { login } from "~/services/auth.service";
import { createUserSession } from "~/services/session.service";
import styles from "./style.module.css";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Username dan password harus diisi' };
  }

  const result = await login({ username, password });

  if (!result.success) {
    return {
      error: result.error,
    };
  }

  const sessionHeaders = await createUserSession(result.user!, '/dashboard', result.token);
  
  return redirect('/dashboard', {
    headers: {
      'Set-Cookie': sessionHeaders['Set-Cookie']
    },
  });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const data = actionData as {
    error?: string;
  } | undefined;
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={styles.container}>
      <Card className={styles.loginCard}>
        <div className={styles.cardHeaderAction}>
          <Link to="/" className={styles.backLink}>
            <ArrowLeft className={styles.backIcon} />
            Back to Ticket Submit
          </Link>
        </div>

        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <img
              src="/logo/it-logo.png"
              alt="Logo ITANI"
              className={styles.icon}
            />
          </div>
          <h1 className={styles.title}>IT Support Login</h1>
          <p className={styles.subtitle}>Sign in to access your dashboard</p>
        </div>

        <Form method="post" className={styles.form}>
          {data?.error && (
            <Alert
              variant="destructive"
              className={styles.alert}
            >
              <AlertCircle style={{ width: "16px", height: "16px" }} />
              <div>{data.error}</div>
            </Alert>
          )}

          <div className={styles.formGroup}>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="Your username"
              required
              autoComplete="username"
            />
          </div>

          <div className={styles.formGroup}>
            <Label htmlFor="password">Password</Label>
            <div className={styles.passwordWrapper}>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className={styles.passwordInput}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.toggleButton}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff style={{ width: "16px", height: "16px" }} />
                ) : (
                  <Eye style={{ width: "16px", height: "16px" }} />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className={styles.loginButton}
          >
            <LogIn style={{ width: "16px", height: "16px", marginRight: "8px" }} />
            Sign In
          </Button>
        </Form>
      </Card>
    </div>
  );
}
