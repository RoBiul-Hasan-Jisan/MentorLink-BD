import './globals.css';
export const metadata = { title: 'MentorLink BD Admin', description: 'Admin panel' };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Hind+Siliguri:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
