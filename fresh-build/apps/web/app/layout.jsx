import './styles.css';

export const metadata = {
  title: 'Masjid E Mamoor 2',
  description: 'Masjid information and management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
