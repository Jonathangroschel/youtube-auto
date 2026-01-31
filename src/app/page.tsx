import Navbar from "@/components/landing/Navbar";
import RedirectAuthedToDashboard from "@/components/landing/RedirectAuthedToDashboard";
import Hero from "@/components/landing/Hero";
import VideoSection from "@/components/landing/VideoSection";
import Workflows from "@/components/landing/Workflows";
import EditorPreview from "@/components/landing/EditorPreview";
import Features from "@/components/landing/Features";
import Testimonials from "@/components/landing/Testimonials";
import TrustScore from "@/components/landing/TrustScore";
import CoFounder from "@/components/landing/CoFounder";
import FAQs from "@/components/landing/FAQs";
import Footer from "@/components/landing/Footer";

export const dynamic = "force-static";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <RedirectAuthedToDashboard />
      <Navbar />
      <Hero />
      <VideoSection />
      <EditorPreview />
      <Workflows />
      <Features />
      <Testimonials />
      <TrustScore />
      <CoFounder />
      <FAQs />
      <Footer />
    </main>
  );
}
