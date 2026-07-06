export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const hasError = firstParam(params.error) === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">SupplementScout Admin</h1>
        <form action="/admin/login/session" method="post" className="mt-6">
          <label
            htmlFor="admin-password"
            className="text-sm font-semibold text-zinc-700"
          >
            Password
          </label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950"
          />
          {hasError && (
            <p className="mt-3 text-sm font-medium text-red-700">
              Invalid credentials.
            </p>
          )}
          <button
            type="submit"
            className="mt-5 w-full rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
