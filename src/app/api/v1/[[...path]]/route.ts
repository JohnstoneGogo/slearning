import { dispatch } from '@/server/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ path?: string[] }> };
const handle = async (req: Request, { params }: Ctx) => dispatch(req, (await params).path ?? []);
export const GET = handle, POST = handle, PUT = handle, PATCH = handle, DELETE = handle;
export const OPTIONS = () => new Response(null, { status: 204 });
