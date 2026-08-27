import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginButton } from "@/features/auth/components/login-button";
import { Dashboard } from "@/features/dashboard/components/dashboard";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="login-shell">
        <p className="eyebrow">SHARED SHOPPING</p>
        <h1>IRU MONO</h1>
        <p className="login-copy">買うものを、ひとつの場所に。</p>
        <LoginButton />
      </main>
    );
  }

  return <Dashboard email={user.email ?? ""} userId={user.id} />;
}
