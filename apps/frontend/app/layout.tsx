import "./globals.css";

export const metadata = {
  title: "Infovion Academic SaaS",
  description: "Academic ERP Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
