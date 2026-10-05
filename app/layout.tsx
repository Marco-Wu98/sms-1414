import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Đối chiếu SMS 1414 | Nội bộ",
  description: "Đối chiếu cục bộ số thuê bao SMS 1414 với danh sách Excel và đánh STT lên PDF.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
