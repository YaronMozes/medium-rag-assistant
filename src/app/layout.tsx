import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Medium RAG Assistant",
  description: "A retrieval-augmented assistant for the Medium article dataset"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
