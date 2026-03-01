import { render, screen } from '@testing-library/react';
import { Shield } from 'lucide-react';
import { AdminPageShell } from '@/components/admin/admin-page-shell';

describe('AdminPageShell', () => {
  test('renders eyebrow, title, description, actions, and content', () => {
    render(
      <AdminPageShell
        eyebrow="Admin"
        title="Access Review"
        description="ตรวจสอบคิวสิทธิ์และงานติดตาม"
        icon={Shield}
        actions={<button type="button">Refresh</button>}
      >
        <div>Page content</div>
      </AdminPageShell>,
    );

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Access Review' })).toBeInTheDocument();
    expect(screen.getByText('ตรวจสอบคิวสิทธิ์และงานติดตาม')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });
});
