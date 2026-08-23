import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const apiKey = (await cookies()).get('admin_api_key')?.value;
  redirect(apiKey ? '/dashboard' : '/login');
}
