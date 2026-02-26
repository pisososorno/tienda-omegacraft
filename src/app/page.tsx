// Root / is served via beforeFiles rewrite → /home (see next.config.mjs)
// This file is only reached if the rewrite is bypassed (e.g. build-time).
import { redirect } from "next/navigation";

export default function RootFallback() {
  redirect("/home");
}
