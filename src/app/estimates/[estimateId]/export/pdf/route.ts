import { UnauthorizedError } from "@/auth/authorization";
import {
  estimatePdfFilename,
} from "@/exports/estimate-exhibit";
import { loadEstimateExhibit } from "@/exports/estimate-exhibit-service";
import { renderEstimatePdf } from "@/exports/estimate-pdf";
import { EstimateNotFoundError } from "@/projects/service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ estimateId: string }> },
) {
  const { estimateId } = await params;
  try {
    const exhibit = await loadEstimateExhibit(estimateId);
    const pdf = await renderEstimatePdf(exhibit);
    const body = new Uint8Array(pdf.byteLength);
    body.set(pdf);
    return new Response(body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${estimatePdfFilename(exhibit)}"`,
        "Content-Length": String(pdf.byteLength),
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof EstimateNotFoundError) {
      return new Response("Estimate not found", { status: 404 });
    }
    if (error instanceof UnauthorizedError) {
      const signIn = new URL("/sign-in", request.url);
      signIn.searchParams.set("callbackUrl", new URL(request.url).pathname);
      return Response.redirect(signIn);
    }
    throw error;
  }
}
