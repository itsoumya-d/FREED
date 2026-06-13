import { getBackendArchitectureReadiness } from "@/lib/backend-architecture";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export function GET() {
  return Response.json(getBackendArchitectureReadiness(process.env), {
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store"
    }
  });
}
