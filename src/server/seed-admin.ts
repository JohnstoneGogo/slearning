export type SeedAdminCredentials = {
  username: string;
  email: string;
  password: string;
};

type SeedAdminEnv = Record<string, string | undefined>;

export function getSeedAdminCredentials(
  env: SeedAdminEnv,
): SeedAdminCredentials {
  const username = env.ADMIN_USERNAME?.trim().toLowerCase();
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;

  if (!username || !email || !password) {
    throw new Error('Set ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD before seeding.');
  }
  if (password === 'Admin#12345' || password.length < 16 || new Set(password).size < 8) {
    throw new Error('ADMIN_PASSWORD must be a unique password of at least 16 characters.');
  }

  return { username, email, password };
}
