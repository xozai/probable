"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { isEmailAllowed, normalizeEmail, parseAllowedEmails } from "./email-policy";

export async function requestMagicLink(formData: FormData): Promise<void> {
  const submitted = formData.get("email");
  if (typeof submitted !== "string" || !submitted.trim()) {
    redirect("/sign-in/error");
  }
  const email = normalizeEmail(submitted);
  if (!isEmailAllowed(email, parseAllowedEmails(process.env.AUTH_ALLOWED_EMAILS))) {
    redirect("/sign-in/error");
  }

  let failed = false;
  try {
    const redirectTo = process.env.AUTH_URL
      ? new URL("/", process.env.AUTH_URL).toString()
      : "/";
    const destination = await signIn("resend", {
      email,
      redirect: false,
      redirectTo,
    });
    failed = !destination || new URL(destination).searchParams.has("error");
  } catch (error) {
    if (error instanceof AuthError) {
      failed = true;
    } else {
      throw error;
    }
  }

  redirect(failed ? "/sign-in/error" : "/sign-in/check-email");
}
