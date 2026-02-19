import "./globals.css";

export const metadata = {
  title: "Dota2 Match Analyzer",
  description: "Fetch OpenDota match data and export markdown for LLM analysis."
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
