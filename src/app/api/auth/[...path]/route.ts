import { neonAuth } from "@/lib/neon/auth"

export const GET: ReturnType<ReturnType<typeof neonAuth>["handler"]>["GET"] =
  (request, context) => neonAuth().handler().GET(request, context)
export const POST: ReturnType<ReturnType<typeof neonAuth>["handler"]>["POST"] =
  (request, context) => neonAuth().handler().POST(request, context)
