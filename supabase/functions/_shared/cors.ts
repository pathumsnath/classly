// Shared CORS headers — the Flutter app calls these functions directly
// from a mobile client, not a browser, but keeping CORS permissive here
// costs nothing and avoids surprises if a web-based test harness (curl
// from a browser console, a Postman-in-browser tool, etc.) is used
// during development.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
