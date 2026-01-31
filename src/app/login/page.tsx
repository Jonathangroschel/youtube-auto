"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { login, signup } from "./actions";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { ShaderRipple } from "@/components/shader-ripple";
import { ShaderVoid } from "@/components/shader-void";
import { GradientWave } from "@/components/gradient-wave";
import { ShaderRGB } from "@/components/shader-rgb";
import { RenderCanvas } from "@/components/render-canvas";

// Slideshow data for the right panel
const slides = [
  {
    id: 1,
    title: "QUICK SUBTITLES",
    subtitle: "Add eye-catching captions to your videos in seconds",
    shader: "void",
  },
  {
    id: 2,
    title: "AUTO CLIP",
    subtitle: "Transform long videos into viral clips automatically",
    shader: "ripple",
  },
  {
    id: 3,
    title: "SPLIT SCREEN",
    subtitle: "Create engaging split-screen content effortlessly",
    shader: "wave",
  },
  {
    id: 4,
    title: "REDDIT VIDEOS",
    subtitle: "Generate viral Reddit story videos with AI narration",
    shader: "rgb",
  },
  {
    id: 5,
    title: "STREAMER BLUR",
    subtitle: "Professional streamer-style video formatting instantly",
    shader: "canvas",
  },
];

// SVG Icons
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20">
    <path d="M18.8 10.209C18.8 9.55898 18.7417 8.93398 18.6333 8.33398H10V11.8798H14.9333C14.7208 13.0257 14.075 13.9965 13.1042 14.6465V16.9465H16.0667C17.8 15.3507 18.8 13.0007 18.8 10.209Z" fill="#4285F4" />
    <path d="M10.0003 19.1672C12.4753 19.1672 14.5503 18.3464 16.0669 16.9464L13.1044 14.6464C12.2836 15.1964 11.2336 15.5214 10.0003 15.5214C7.61276 15.5214 5.59193 13.9089 4.87109 11.7422H1.80859V14.1172C3.31693 17.113 6.41693 19.1672 10.0003 19.1672Z" fill="#34A853" />
    <path d="M4.86953 11.7411C4.6862 11.1911 4.58203 10.6036 4.58203 9.99948C4.58203 9.39531 4.6862 8.80781 4.86953 8.25781V5.88281H1.80703C1.16536 7.16019 0.831466 8.56999 0.832032 9.99948C0.832032 11.4786 1.1862 12.8786 1.80703 14.1161L4.86953 11.7411Z" fill="#FBBC05" />
    <path d="M10.0003 4.47982C11.3461 4.47982 12.5544 4.94232 13.5044 5.85065L16.1336 3.22148C14.5461 1.74232 12.4711 0.833984 10.0003 0.833984C6.41693 0.833984 3.31693 2.88815 1.80859 5.88398L4.87109 8.25898C5.59193 6.09232 7.61276 4.47982 10.0003 4.47982Z" fill="#EA4335" />
  </svg>
);

const EmailIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.75 4C2.7835 4 2 4.7835 2 5.75V6.78938L11.8876 11.7646C11.9583 11.8002 12.0417 11.8002 12.1124 11.7646L22 6.78938V5.75C22 4.7835 21.2165 4 20.25 4H3.75Z" fill="currentColor" />
    <path d="M22 8.46856L12.7866 13.1045C12.2917 13.3535 11.7082 13.3535 11.2134 13.1045L2 8.46856V18.25C2 19.2165 2.7835 20 3.75 20H20.25C21.2165 20 22 19.2165 22 18.25V8.46856Z" fill="currentColor" />
  </svg>
);

const SLIDE_DURATION = 6000; // 6 seconds per slide

// Shader background component for each slide
const SlideShaderBackground = ({ shader }: { shader: string }) => {
  switch (shader) {
    case "ripple":
      return (
        <ShaderRipple
          color1="#FF00FF"
          color2="#8B5CF6"
          color3="#EC4899"
          lineWidth={0.003}
          className="absolute inset-0"
        />
      );
    case "void":
      return (
        <div className="absolute inset-0 bg-black">
          <ShaderVoid
            voidBallsAmount={0}
            voidBallsColor="#a855f7"
            plasmaBallsColor="#FF00FF"
            plasmaBallsStroke="#8B5CF6"
            gooeyCircleSize={50}
            blendMode="screen"
          />
        </div>
      );
    case "wave":
      return (
        <div className="absolute inset-0">
          <GradientWave 
            colors={["#a855f7", "#6366f1", "#ec4899", "#8b5cf6"]}
          />
        </div>
      );
    case "rgb":
      return (
        <div className="absolute inset-0">
          <ShaderRGB />
        </div>
      );
    case "canvas":
      return (
        <div className="absolute inset-0">
          <RenderCanvas
            colorHue={280}
            colorSaturation={100}
            colorLightness={60}
            trails={60}
            lineWidth={8}
            className="w-full h-full"
          />
        </div>
      );
    default:
      return null;
  }
};

function LoginContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const [currentSlide, setCurrentSlide] = useState(0); // Start with QUICK SUBTITLES (now first)
  const [slideProgress, setSlideProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  
  // Key to reset CSS animation on slide change
  const [progressKey, setProgressKey] = useState(0);

  // Auto-advance slideshow
  useEffect(() => {
    // Start progress animation via CSS
    setSlideProgress(100);
    
    const timer = setTimeout(() => {
      setCurrentSlide((current) => (current + 1) % slides.length);
      setSlideProgress(0);
      setProgressKey((k) => k + 1); // Reset animation
      // Small delay before starting next progress
      setTimeout(() => setSlideProgress(100), 50);
    }, SLIDE_DURATION);

    return () => clearTimeout(timer);
  }, [currentSlide]);

  // Handle slide click
  const handleSlideClick = useCallback((index: number) => {
    setCurrentSlide(index);
    setSlideProgress(0);
    setProgressKey((k) => k + 1);
    // Start progress after brief delay
    setTimeout(() => setSlideProgress(100), 50);
  }, []);

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = isSignUp ? await signup(formData) : await login(formData);
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
      // If no error, user will be redirected by the server action
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Always use the canonical production URL for OAuth callback
      const redirectUrl = process.env.NODE_ENV === "development"
        ? `${window.location.origin}/auth/callback`
        : "https://saturaai.com/auth/callback";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
      }
      // If successful, user will be redirected to Google
    } catch {
      setError("Failed to initiate Google sign-in");
      setIsLoading(false);
    }
  };

  const currentSlideData = slides[currentSlide];

  return (
    <div className="login-page">
      {/* Left side - Login Form */}
      <div className="login-form-container">
        <div className="login-form-content">
          {/* Logo */}
          <div className="login-logo">
            <Image
              src="/icon.svg"
              alt="Satura"
              width={48}
              height={48}
              className="login-logo-img"
            />
          </div>

          <h1 className="login-title">Welcome to Satura</h1>
          <p className="login-subtitle">Sign in to start creating viral content</p>

          {/* Error message */}
          {error && (
            <div className="login-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/>
              </svg>
              {error}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="login-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/>
              </svg>
              {success}
            </div>
          )}

          {/* Auth Buttons */}
          {!showEmailForm ? (
            <div className="login-buttons">
              <button 
                type="button" 
                className="login-oauth-btn"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <GoogleIcon />
                {isLoading ? "Loading..." : "Continue with Google"}
              </button>

              <div className="login-divider">
                <span>OR</span>
              </div>

              <button 
                type="button" 
                className="login-oauth-btn"
                onClick={() => setShowEmailForm(true)}
                disabled={isLoading}
              >
                <EmailIcon />
                Continue with Email
              </button>
            </div>
          ) : (
            <form className="login-email-form" action={handleSubmit}>
              <div className="login-form-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="login-form-field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  minLength={6}
                />
              </div>

              <button 
                type="submit" 
                className="login-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : isSignUp ? "Sign up" : "Sign in"}
              </button>

              <button
                type="button"
                className="login-toggle-mode"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setSuccess(null);
                }}
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>

              <button
                type="button"
                className="login-back-btn"
                onClick={() => {
                  setShowEmailForm(false);
                  setError(null);
                  setSuccess(null);
                }}
              >
                ← Back to all options
              </button>
            </form>
          )}

          {/* Legal text */}
          <p className="login-legal">
            By continuing, I acknowledge the{" "}
            <a href="/privacy-policy">Privacy Policy</a> and agree to the{" "}
            <a href="/terms-of-service">Terms of Use</a>.
          </p>
        </div>
      </div>

      {/* Right side - Slideshow (hidden on mobile) */}
      <div className="login-slideshow">
        <div className="login-slideshow-inner">
          {/* Single active slide - only render one shader at a time to prevent WebGL context exhaustion */}
          <div className="login-slides">
            <div className="login-slide active" key={currentSlide}>
              {/* Only render the current shader to conserve WebGL contexts */}
              <SlideShaderBackground shader={currentSlideData.shader} />
              <div className="login-slide-gradient" />
            </div>
          </div>

          {/* Slide content overlay */}
          <div className="login-slide-content">
            <h2 className="login-slide-title">{currentSlideData.title}</h2>
            <p className="login-slide-subtitle">{currentSlideData.subtitle}</p>
          </div>

          {/* Progress navigation */}
          <div className="login-slideshow-nav">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`login-nav-item ${index === currentSlide ? "active" : ""}`}
                onClick={() => handleSlideClick(index)}
              >
                <div className="login-nav-progress">
                  <div
                    key={index === currentSlide ? progressKey : `static-${index}`}
                    className={`login-nav-progress-fill ${index === currentSlide ? "animating" : ""}`}
                    style={{
                      width: index === currentSlide ? `${slideProgress}%` : index < currentSlide ? "100%" : "0%",
                      transition: index === currentSlide && slideProgress === 100 
                        ? `width ${SLIDE_DURATION}ms linear` 
                        : "none",
                    }}
                  />
                </div>
                <span className="login-nav-label">{slide.title.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-page">
        <div className="login-form-container">
          <div className="login-form-content">
            <div className="login-logo">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600" />
            </div>
            <h1 className="login-title">Welcome to Satura</h1>
            <p className="login-subtitle">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
