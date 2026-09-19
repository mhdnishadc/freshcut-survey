import { redirect } from "next/navigation";

/** Field staff are the main users, so the survey is the front door. */
export default function Home() {
  redirect("/survey");
}
