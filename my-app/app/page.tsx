import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect all requests from "/" to the AI Planning experience
  redirect('/planning');
}

