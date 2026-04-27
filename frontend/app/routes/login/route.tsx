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

// ISOLATION TEST: Change this number (1 to 5) to test each step
// Step 1: Minimal Action (Return JSON) - Proves action is reached
// Step 2: Add FormData Parsing - Proves request body is valid
// Step 3: Add login() Service Call - Proves fetch is working
// Step 4: Add Simple Redirect (No headers) - Proves redirect works
// Step 5: Add Redirect with Session Cookie - Final integration
const DEBUG_STEP = 5; 

export async function action({ request }: Route.ActionArgs) {
  console.log(`[DEBUG] Starting Login Action - Step ${DEBUG_STEP}`);

  try {
    // --- STEP 1: Minimal Action ---
    if (DEBUG_STEP === 1) {
      console.log('[DEBUG] Step 1: Minimal success');
      return { step: 1, success: true };
    }

    // --- STEP 2: FormData Parsing ---
    console.log('[DEBUG] Step 2: Parsing FormData');
    const formData = await request.formData();
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    
    if (DEBUG_STEP === 2) {
      console.log('[DEBUG] Step 2: Success', { username });
      return { step: 2, username };
    }

    // --- STEP 3: login() Service Call ---
    console.log('[DEBUG] Step 3: Calling login() service');
    const result = await login({ username, password });
    
    if (DEBUG_STEP === 3) {
      console.log('[DEBUG] Step 3: Success', { success: result.success });
      return { step: 3, result };
    }

    if (!result.success || !result.user || !result.token) {
      console.warn('[DEBUG] Login failed result', result);
      return { error: result.error || 'Login failed' };
    }

    // --- STEP 4: Simple Redirect (No headers) ---
    if (DEBUG_STEP === 4) {
      console.log('[DEBUG] Step 4: Success - Attempting simple redirect');
      return redirect('/dashboard');
    }

    // --- STEP 5: Redirect with Session Cookie ---
    console.log('[DEBUG] Step 5: Creating session and redirecting with headers');
    const sessionHeaders = await createUserSession(result.user, '/dashboard', result.token);
    const cookie = sessionHeaders['Set-Cookie'];

    if (!cookie) {
      console.error('[DEBUG] Step 5: Missing cookie!');
      return { error: 'Gagal membuat cookie' };
    }

    console.log('[DEBUG] Step 5: Success - Redirecting with cookie');
    // Using new Headers() for maximum compatibility
    const headers = new Headers();
    headers.append('Set-Cookie', cookie);
    
    return redirect('/dashboard', { headers });

  } catch (error: any) {
    console.error('[DEBUG] FATAL CRASH at step', DEBUG_STEP, error);
    return { 
      error: 'Crash isolated', 
      step: DEBUG_STEP, 
      message: error?.message || String(error) 
    };
  }
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
