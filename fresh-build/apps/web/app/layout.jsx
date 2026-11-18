import './styles.css';
import AppBar from './app-bar.jsx';
import RegisterServiceWorker from './register-sw.jsx';

export const metadata = {
  title: 'Masjid E Mamoor 2',
  description: 'Masjid information and management',
  applicationName: 'Masjid E Mamoor 2',
  appleWebApp: { capable: true, title: 'Mamoor 2', statusBarStyle: 'default' },
};

export const viewport = {
  themeColor: '#0b4a3a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppBar />
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
