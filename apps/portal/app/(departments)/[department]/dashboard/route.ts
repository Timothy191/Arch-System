import { redirect } from 'next/navigation';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ department: string }> }
) {
  const { department } = await params;
  redirect(`/${department}`);
}
