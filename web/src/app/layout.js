import './globals.css';
import { AuthProvider } from '../lib/auth';

export const metadata = {
  title: 'Fly Book',
  description: 'Aviation logbook for pilots',
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=News+Cycle&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
