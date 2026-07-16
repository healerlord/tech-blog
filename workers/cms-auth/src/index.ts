export interface CmsAuthEnv {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_DOMAINS: string;
  ALLOWED_USERS: string;
}

interface AuthMessage {
  token?: string;
  error?: string;
  errorCode?: string;
}

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const outputHtml = ({ token, error, errorCode }: AuthMessage) => {
  const state = error ? "error" : "success";
  const content = error
    ? { provider: "github", error, errorCode }
    : { provider: "github", token };

  return new Response(
    `<!doctype html><html><body><script>
      (() => {
        window.addEventListener('message', ({ data, origin }) => {
          if (data === 'authorizing:github') {
            window.opener?.postMessage(
              'authorization:github:${state}:${JSON.stringify(content)}',
              origin
            );
          }
        });
        window.opener?.postMessage('authorizing:github', '*');
      })();
    </script></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie":
          "csrf-token=deleted; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure",
      },
    },
  );
};

const fail = (errorCode: string, error: string) =>
  outputHtml({ errorCode, error });

function requireEnvironment(env: CmsAuthEnv) {
  if (
    !env.GITHUB_CLIENT_ID ||
    !env.GITHUB_CLIENT_SECRET ||
    !env.ALLOWED_DOMAINS ||
    !env.ALLOWED_USERS
  ) {
    return fail(
      "MISCONFIGURED_CLIENT",
      "OAuth Worker configuration is incomplete.",
    );
  }
}

export async function handleAuth(request: Request, env: CmsAuthEnv) {
  const invalidEnvironment = requireEnvironment(env);
  if (invalidEnvironment) return invalidEnvironment;

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const domain = searchParams.get("site_id")?.toLowerCase();

  if (provider !== "github") {
    return fail("UNSUPPORTED_BACKEND", "Only GitHub is supported.");
  }

  if (!domain || !splitList(env.ALLOWED_DOMAINS).includes(domain)) {
    return fail("UNSUPPORTED_DOMAIN", "This domain is not allowed.");
  }

  const csrfToken = crypto.randomUUID().replaceAll("-", "");
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    scope: "public_repo read:user",
    state: csrfToken,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      "Set-Cookie":
        `csrf-token=github_${csrfToken}; ` +
        "HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure",
    },
  });
}

export async function handleCallback(request: Request, env: CmsAuthEnv) {
  const invalidEnvironment = requireEnvironment(env);
  if (invalidEnvironment) return invalidEnvironment;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookie = request.headers.get("Cookie") ?? "";
  const [, csrfToken] =
    cookie.match(/\bcsrf-token=github_([0-9a-f]{32})\b/) ?? [];

  if (!code || !state) {
    return fail(
      "AUTH_CODE_REQUEST_FAILED",
      "GitHub returned no authorization code.",
    );
  }

  if (!csrfToken || state !== csrfToken) {
    return fail("CSRF_DETECTED", "OAuth state validation failed.");
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
      }),
    });
  } catch {
    return fail("TOKEN_REQUEST_FAILED", "GitHub token request failed.");
  }

  const tokenPayload = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
  } | null;
  const token = tokenPayload?.access_token;

  if (!token) {
    return fail(
      "TOKEN_REQUEST_FAILED",
      tokenPayload?.error ?? "GitHub returned no access token.",
    );
  }

  let userResponse: Response;
  try {
    userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "kyrie-dev-cms-auth",
      },
    });
  } catch {
    return fail("USER_REQUEST_FAILED", "GitHub user lookup failed.");
  }

  const user = (await userResponse.json().catch(() => null)) as {
    login?: string;
  } | null;

  if (
    !user?.login ||
    !splitList(env.ALLOWED_USERS).includes(user.login.toLowerCase())
  ) {
    return fail("UNAUTHORIZED_USER", "This GitHub user is not allowed.");
  }

  return outputHtml({ token });
}

export default {
  async fetch(request: Request, env: CmsAuthEnv) {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/auth") {
      return handleAuth(request, env);
    }

    if (request.method === "GET" && pathname === "/callback") {
      return handleCallback(request, env);
    }

    return new Response(null, { status: 404 });
  },
};
