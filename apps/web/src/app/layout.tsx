import type {ReactNode} from 'react';

export const metadata = {
  title: 'Remotion Agent',
  description: 'Control plane for sandboxed Remotion video jobs',
};

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <body style={{margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f7f7f5'}}>
        {children}
      </body>
    </html>
  );
}
