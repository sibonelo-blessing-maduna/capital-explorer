import { Router } from "express";
import {
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  isGoogleOAuthConfigured,
  newOAuthState,
} from "../auth/google";
import { verifyAdminLogin } from "../auth/adminLocal";
import { Users, AuditLog } from "../db";

export const authRouter = Router();

function publicUser(u: NonNullable<Express.Request["currentUser"]>) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatar_url,
    role: u.role,
    isSuperAdmin: Boolean(u.is_super_admin),
  };
}

authRouter.get("/me", (req, res) => {
  res.json({
    user: req.currentUser ? publicUser(req.currentUser) : null,
    googleConfigured: isGoogleOAuthConfigured(),
  });
});

// --- Google OAuth -----------------------------------------------------

authRouter.get("/google", (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    return res.status(503).send("Google sign-in is not configured on this server yet.");
  }
  const state = newOAuthState();
  req.session.oauthState = state;
  res.redirect(buildGoogleAuthUrl(state));
});

authRouter.get("/google/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  const expectedState = req.session.oauthState;
  req.session.oauthState = undefined;

  if (!code || !state || !expectedState || state !== expectedState) {
    return res.status(400).send("OAuth state mismatch or missing code — please try signing in again.");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchGoogleUserInfo(tokens.access_token);

    const user = Users.upsertGoogleUser({
      googleId: profile.sub,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
    });

    if (user.blocked) {
      return res.status(403).send("This account has been blocked.");
    }

    req.session.userId = user.id;
    Users.touchLogin(user.id);
    res.redirect("/");
  } catch (err) {
    console.error("[auth] Google callback failed:", err);
    res.status(500).send("Sign-in failed. Please try again.");
  }
});

// --- Admin (email/password) -------------------------------------------

authRouter.post("/admin-login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "email and password are required" });
  }
  const user = verifyAdminLogin(email, password);
  if (!user) {
    AuditLog.record(null, "admin_login_failed", email);
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (user.blocked) return res.status(403).json({ error: "This account has been blocked" });

  req.session.userId = user.id;
  Users.touchLogin(user.id);
  AuditLog.record(user.id, "admin_login_success");
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.json({ ok: true });
  });
});
