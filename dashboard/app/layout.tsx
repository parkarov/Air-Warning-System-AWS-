import type { Metadata } from "next";
import { Geist, Geist_Mono, Open_Sans, Sedan_SC } from "next/font/google";
import "./globals.css";
import AutoRefresh from "./components/AutoRefresh";
import Bar from "./components/Bar";
import Button from "./components/Button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const sedanSC = Sedan_SC({
  variable: "--font-sedan-sc",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Air Warning System",
  description: "AWS dashboard the goat",
  icons: {
    icon: "/LogoTemp.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${openSans.variable} ${sedanSC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AutoRefresh seconds={30} />
        <div className="relative flex min-h-screen flex-col bg-cover bg-center bg-no-repeat bg-[url('/bg.png')]">
          <div className="glass-bg absolute inset-0" />
          <div className="bg-texture absolute inset-0" />
          {/* Header height = its contents, all sized in vh (capped by vw so text
              fits narrow screens): 3 + 4 bars + ~11.25 text + 2x title py ≈ 22% of the screen. */}
          <header className="relative flex shrink-0 flex-col font-sedan text-black">
            <Bar className="h-[3vh]" />
            {/* py here sets the logo title's top/bottom spacing */}
            <div className="flex flex-col gap-[0.5vh] py-[2vh] leading-none text-shadow-[0_0_10px_#FFFFFF]">
              <p className="text-[min(7vh,8vw)]">Air Warning System</p>
              <p className="text-[min(3.75vh,4.5vw)]">1st Imperial Shrimp Regiment</p>
            </div>
            <Bar className="h-[4vh] flex-row-reverse">
              <Button href="/explore">Explore</Button>
              <Button href="/map">Map</Button>
              <Button href="/">Home</Button>
            </Bar>
          </header>

          {/* Each subpage renders here, filling the space below the bar */}
          <main className="relative flex flex-1 flex-col text-black font-opensans">{children}</main>
          <Bar className="relative h-8" />
        </div>
      </body>
    </html>
  );
}
