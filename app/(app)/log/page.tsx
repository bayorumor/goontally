import { redirect } from "next/navigation";

// Logging happens in the quick-log sheet now; old links open it on Home.
export default function LogPage() {
  redirect("/?log=1");
}
