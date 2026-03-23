// =====================================================
// PAGE: Super Admin - Redirect to Tenants
// =====================================================

import { redirect } from 'next/navigation';

export default function SuperAdminPage() {
  redirect('/admin/tenants');
}
