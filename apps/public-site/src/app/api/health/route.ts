export async function GET() {
  return Response.json({
    status: "ok",
    service: "qiuaihub",
    timestamp: new Date().toISOString(),
  });
}
