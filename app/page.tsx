import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user?.role === "Admin") {
    redirect("/admin");
  } else if (["Sales Person", "Lead", "Member"].includes(session.user?.role as string)) {
    redirect("/sales");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600">Unauthorized</h1>
        <p className="mt-2 text-gray-600">Your account does not have permission to access the CRM.</p>
        <p className="mt-1 text-sm text-gray-400">Role: {session.user?.role || "None"}</p>
        <a href="/api/auth/signout" className="mt-4 inline-block text-primary hover:underline">
          Sign out and try another code
        </a>
      </div>
    </div>
  );
}
