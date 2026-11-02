import { Inter } from "next/font/google";
import "./globals.css";
import "./prism.css";
import { AppContextProvider } from "@/context/AppContext";
import { GitHubProvider } from "@/context/GitHubContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "Vexora",
  description: "Vexora — a local-first AI chat powered by free AI models",
  applicationName: "Vexora",
};

export default function RootLayout({ children }) {
  return (
    <AppContextProvider>
      <GitHubProvider>
        <html lang="en">
          <body className={`${inter.className} antialiased`}>
            <Toaster
              toastOptions={{
                success: { style: { background: "black", color: "white" } },
                error: { style: { background: "black", color: "white" } },
              }}
            />
            {children}
          </body>
        </html>
      </GitHubProvider>
    </AppContextProvider>
  );
}
