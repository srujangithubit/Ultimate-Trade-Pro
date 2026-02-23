import PageTransition from '@/components/ui/page-transition';
import { ReactNode } from 'react';

export default function Template({ children }: { children: ReactNode }) {
    return <PageTransition>{children}</PageTransition>;
}
