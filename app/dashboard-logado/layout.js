import AuthGuard from "../components/AuthGuard";

export default function DashboardLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
