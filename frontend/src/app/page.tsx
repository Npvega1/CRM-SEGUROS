import { redirect } from 'next/navigation';

export default function Home() {
  // Redirigir a login por defecto
  // El middleware se encargará de redirigir a dashboard si ya está autenticado
  redirect('/login');
}
