import "./globals.css";

export const metadata = {
    title: "Live Draw",
    description: "Real-time collaborative drawing on a physical canvas.",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
