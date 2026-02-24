import DashboardLayout from '@/components/layouts/DashboardLayout';
import { MT5Provider } from '@/components/mt5/MT5Context';

export default function DashboardGroupLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <MT5Provider>
            <DashboardLayout>{children}</DashboardLayout>
        </MT5Provider>
    );
}
