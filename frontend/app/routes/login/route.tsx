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
  const startTime = Date.now();
  console.log(`[Login Action] START - ${new Date().toISOString()}`);

  try {
    // 1. Safe FormData Extraction
    console.log('[Login Action] Step 1: Extracting formData');
    let formData: FormData;
    try {
      if (!request.body) {
        console.error('[Login Action] Request body is null');
        return { error: 'Request body kosong' };
      }
      formData = await request.formData();
      console.log('[Login Action] formData extracted successfully');
    } catch (fdError) {
      console.error('[Login Action] CRITICAL: Failed to extract formData:', fdError);
      return { error: 'Gagal memproses data form. Silakan coba lagi.' };
    }

    const username = formData.get('username');
    const password = formData.get('password');

    // 2. Validation
    console.log('[Login Action] Step 2: Validating fields');
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      console.warn('[Login Action] Validation failed: Missing or invalid fields');
      return { error: 'Username dan password harus diisi' };
    }

    // 3. Login Service Call
    console.log(`[Login Action] Step 3: Calling login() for user: ${username}`);
    let result;
    try {
      result = await login({ username, password });
      console.log('[Login Action] login() returned:', { 
        success: result?.success, 
        hasUser: !!result?.user, 
        hasToken: !!result?.token 
      });
    } catch (loginError) {
      console.error('[Login Action] CRITICAL: login() service threw an exception:', loginError);
      return { error: 'Gagal menghubungi server otentikasi.' };
    }

    if (!result.success) {
      console.warn('[Login Action] Login unsuccessful:', result.error);
      return { error: result.error || 'Login gagal' };
    }

    if (!result.user || !result.token) {
      console.error('[Login Action] Login succeeded but missing user/token data');
      return { error: 'Response data tidak lengkap dari server.' };
    }

    // 4. Session Creation
    console.log('[Login Action] Step 4: Creating user session');
    let sessionHeaders;
    try {
      sessionHeaders = await createUserSession(result.user, '/dashboard', result.token);
      console.log('[Login Action] Session created successfully');
    } catch (sessionError) {
      console.error('[Login Action] CRITICAL: createUserSession() threw an exception:', sessionError);
      return { error: 'Gagal membuat sesi login. Silakan coba lagi.' };
    }

    // 5. Final Redirect
    console.log('[Login Action] Step 5: Returning redirect');
    const cookie = sessionHeaders?.['Set-Cookie'];
    if (!cookie) {
      console.error('[Login Action] Missing Set-Cookie header from session creation');
      return { error: 'Gagal mengatur cookie sesi.' };
    }

    console.log(`[Login Action] END - Success - Total time: ${Date.now() - startTime}ms`);
    return redirect('/dashboard', {
      headers: {
        'Set-Cookie': cookie,
      },
    });

  } catch (error) {
    console.error('[Login Action] UNHANDLED EXCEPTION:', error);
    return { error: 'Terjadi kesalahan internal yang tidak terduga.' };
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
