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
  console.log(`[Login Action] START - Method: ${request.method} - URL: ${request.url}`);

  try {
    // 1. Safe FormData Extraction
    console.log('[Login Action] Step 1: Extracting formData');
    let formData: FormData;
    try {
      formData = await request.formData();
      console.log('[Login Action] formData extracted successfully. Keys:', Array.from(formData.keys()));
    } catch (fdError: any) {
      console.error('[Login Action] CRITICAL: request.formData() failed:', fdError);
      // This is a common source of 400 in React Router if the body is malformed
      return { error: `Gagal memproses data form: ${fdError?.message || 'Unknown error'}` };
    }

    const username = formData.get('username');
    const password = formData.get('password');

    // 2. Validation
    console.log('[Login Action] Step 2: Validating fields');
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      console.warn('[Login Action] Validation failed: username or password missing/invalid');
      return { error: 'Username dan password harus diisi dengan benar' };
    }

    // 3. Login Service Call
    console.log(`[Login Action] Step 3: Calling login() for: ${username}`);
    let loginResult;
    try {
      loginResult = await login({ username, password });
      console.log('[Login Action] login() result:', { 
        success: loginResult?.success, 
        hasUser: !!loginResult?.user,
        error: loginResult?.error
      });
    } catch (loginError: any) {
      console.error('[Login Action] CRITICAL: login() service crashed:', loginError);
      return { error: 'Terjadi kesalahan saat menghubungi server otentikasi.' };
    }

    if (!loginResult.success) {
      return { error: loginResult.error || 'Login gagal. Silakan periksa kembali kredensial Anda.' };
    }

    if (!loginResult.user || !loginResult.token) {
      console.error('[Login Action] Login succeeded but user or token is missing');
      return { error: 'Data login tidak lengkap. Silakan coba lagi.' };
    }

    // 4. Session Creation
    console.log('[Login Action] Step 4: Creating user session');
    let cookie: string;
    try {
      const sessionHeaders = await createUserSession(loginResult.user, '/dashboard', loginResult.token);
      cookie = sessionHeaders['Set-Cookie'];
      console.log('[Login Action] Session cookie generated successfully');
    } catch (sessionError: any) {
      console.error('[Login Action] CRITICAL: createUserSession() crashed:', sessionError);
      return { error: 'Gagal membuat sesi login di server.' };
    }

    if (!cookie) {
      console.error('[Login Action] Cookie is empty after session creation');
      return { error: 'Gagal menghasilkan cookie sesi.' };
    }

    // 5. Final Redirect
    console.log('[Login Action] Step 5: Preparing redirect to /dashboard');
    try {
      const headers = new Headers();
      headers.append('Set-Cookie', cookie);
      
      console.log('[Login Action] END - Success - Redirecting...');
      return redirect('/dashboard', { headers });
    } catch (redirectError: any) {
      console.error('[Login Action] CRITICAL: redirect() logic failed:', redirectError);
      return { error: 'Gagal melakukan navigasi setelah login.' };
    }

  } catch (error: any) {
    console.error('[Login Action] UNHANDLED FATAL ERROR:', error);
    return { error: `Kesalahan sistem: ${error?.message || 'Unknown'}` };
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
