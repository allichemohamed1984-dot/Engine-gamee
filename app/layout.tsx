import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Aether 3D Engine',
  description: 'Studio de création de jeux 3D Web Zero-Code basé sur Three.js avec physique Rapier.js 3D, architecture ECS, contrôleur de personnage ZQSD/FPS, système de logique à 3 niveaux (Behavior Cards, Visual Node Graph, Scripts Monaco) et synthétiseur audio.',
  openGraph: {
    title: 'Aether 3D Engine',
    description: 'Studio de création de jeux 3D Web Zero-Code basé sur Three.js avec physique Rapier.js 3D, architecture ECS, contrôleur de personnage ZQSD/FPS, système de logique à 3 niveaux (Behavior Cards, Visual Node Graph, Scripts Monaco) et synthétiseur audio.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aether 3D Engine',
    description: 'Studio de création de jeux 3D Web Zero-Code basé sur Three.js avec physique Rapier.js 3D, architecture ECS, contrôleur de personnage ZQSD/FPS, système de logique à 3 niveaux (Behavior Cards, Visual Node Graph, Scripts Monaco) et synthétiseur audio.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
