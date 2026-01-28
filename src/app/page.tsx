import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server-client";
import Navbar from "@/components/landing/Navbar";
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

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-white">
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
