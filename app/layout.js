import "./globals.css";

export const metadata = {
  title: "صندوق الحظ | Random Box",
  description: "افتح الصندوق واكتشف مفاجأتك"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}