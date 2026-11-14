import { redirect } from "next/navigation";

// "/" has no page of its own. On app.loomxrlabs.com it leads to the dashboard
// (the proxy sends signed-out visitors to /login). On ar.loomxrlabs.com the
// proxy redirects "/" to the marketing site before this runs.
export default function RootPage() {
  redirect("/dashboard");
}
