"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { login, signup } from "./actions";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

// Slideshow data for the right panel
const slides = [
  {
    id: 1,
    title: "AUTO CLIP",
    subtitle: "Transform long videos into viral clips automatically",
    badges: [
      { label: "AI POWERED", icon: "sparkle", variant: "accent" },
      { label: "Viral Ready", icon: "check", variant: "default" },
    ],
  },
  {
    id: 2,
    title: "QUICK SUBTITLES",
    subtitle: "Add eye-catching captions to your videos in seconds",
    badges: [
      { label: "UNLIMITED", icon: "infinity", variant: "accent" },
      { label: "Multi-Language", icon: "check", variant: "default" },
    ],
  },
  {
    id: 3,
    title: "SPLIT SCREEN",
    subtitle: "Create engaging split-screen content effortlessly",
    badges: [
      { label: "TRENDING", icon: "sparkle", variant: "accent" },
      { label: "HD Export", icon: "check", variant: "default" },
    ],
  },
  {
    id: 4,
    title: "REDDIT VIDEOS",
    subtitle: "Generate viral Reddit story videos with AI narration",
    badges: [
      { label: "AI VOICE", icon: "sparkle", variant: "accent" },
      { label: "Auto-Script", icon: "check", variant: "default" },
    ],
  },
  {
    id: 5,
    title: "STREAMER BLUR",
    subtitle: "Professional streamer-style video formatting instantly",
    badges: [
      { label: "PRO LOOK", icon: "infinity", variant: "accent" },
      { label: "One Click", icon: "check", variant: "default" },
    ],
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

const InfinityIcon = () => (
  <svg className="w-4 h-4" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12L15.295 15.3588C17.1149 17.2137 20.0653 17.2137 21.8851 15.3588C23.7049 13.5038 23.7049 10.4962 21.8851 8.64124C20.0653 6.78625 17.1149 6.78625 15.295 8.64124L12 12ZM12 12L8.70495 8.64124C6.88515 6.78625 3.93466 6.78625 2.11485 8.64124C0.295049 10.4962 0.295049 13.5038 2.11485 15.3588C3.93466 17.2137 6.88515 17.2137 8.70495 15.3588L12 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
  </svg>
);

const SparkleIcon = () => (
  <svg className="w-4 h-4" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M17.5124 2.92678C18.1958 2.24336 19.3039 2.24336 19.9873 2.92678L21.0731 4.01256C21.7565 4.69598 21.7565 5.80402 21.0731 6.48744L6.48729 21.0732C5.80387 21.7566 4.69583 21.7566 4.01241 21.0732L2.92663 19.9874C2.24321 19.304 2.24321 18.196 2.92663 17.5126L17.5124 2.92678ZM18.9266 3.98744C18.829 3.88981 18.6707 3.88981 18.5731 3.98744L15.3105 7.25L16.7498 8.68934L20.0124 5.42678C20.11 5.32915 20.11 5.17085 20.0124 5.07322L18.9266 3.98744ZM15.6892 9.75L14.2498 8.31066L3.98729 18.5732C3.88965 18.6709 3.88966 18.8291 3.98729 18.9268L5.07307 20.0126C5.1707 20.1102 5.32899 20.1102 5.42663 20.0126L15.6892 9.75Z" fill="currentColor" />
    <path d="M9.84993 2.07467C9.9467 2.02628 10.0252 1.94782 10.0735 1.85106L10.5518 0.894557C10.7361 0.526033 11.262 0.526033 11.4462 0.894557L11.9245 1.85106C11.9728 1.94782 12.0513 2.02628 12.1481 2.07467L13.1046 2.55292C13.4731 2.73718 13.4731 3.26308 13.1046 3.44734L12.1481 3.92559C12.0513 3.97398 11.9728 4.05244 11.9245 4.1492L11.4462 5.1057C11.262 5.47423 10.7361 5.47423 10.5518 5.1057L10.0735 4.1492C10.0252 4.05244 9.9467 3.97398 9.84993 3.92559L8.89343 3.44734C8.52491 3.26308 8.52491 2.73718 8.89343 2.55292L9.84993 2.07467Z" fill="currentColor" />
    <path d="M18.8499 13.0747C18.9467 13.0263 19.0252 12.9478 19.0735 12.8511L19.5518 11.8946C19.736 11.526 20.262 11.526 20.4462 11.8946L20.9245 12.8511C20.9728 12.9478 21.0513 13.0263 21.1481 13.0747L22.1046 13.5529C22.4731 13.7372 22.4731 14.2631 22.1046 14.4473L21.1481 14.9256C21.0513 14.974 20.9728 15.0524 20.9245 15.1492L20.4462 16.1057C20.262 16.4742 19.736 16.4742 19.5518 16.1057L19.0735 15.1492C19.0252 15.0524 18.9467 14.974 18.8499 14.9256L17.8934 14.4473C17.5249 14.2631 17.5249 13.7372 17.8934 13.5529L18.8499 13.0747Z" fill="currentColor" />
    <path d="M4.84993 7.07467C4.9467 7.02628 5.02516 6.94782 5.07354 6.85106L5.55179 5.89456C5.73605 5.52603 6.26195 5.52603 6.44622 5.89456L6.92447 6.85106C6.97285 6.94782 7.05131 7.02628 7.14807 7.07467L8.10458 7.55292C8.4731 7.73718 8.4731 8.26308 8.10458 8.44734L7.14807 8.92559C7.05131 8.97398 6.97285 9.05244 6.92447 9.1492L6.44622 10.1057C6.26195 10.4742 5.73605 10.4742 5.55179 10.1057L5.07354 9.1492C5.02516 9.05244 4.9467 8.97398 4.84993 8.92559L3.89343 8.44734C3.52491 8.26308 3.52491 7.73718 3.89343 7.55292L4.84993 7.07467Z" fill="currentColor" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.75 13.0625L9.9 16.25L17.25 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SLIDE_DURATION = 6000; // 6 seconds per slide

function LoginContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");

  // Auto-advance slideshow
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setSlideProgress((prev) => {
        if (prev >= 100) {
          setCurrentSlide((current) => (current + 1) % slides.length);
          return 0;
        }
        return prev + (100 / (SLIDE_DURATION / 50));
      });
    }, 50);

    return () => clearInterval(progressInterval);
  }, []);

  // Handle slide click
  const handleSlideClick = useCallback((index: number) => {
    setCurrentSlide(index);
    setSlideProgress(0);
  }, []);

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = isSignUp ? await signup(formData) : await login(formData);
      if (result && "error" in result && result.error) {
        setError(result.error);
      } else if (result && "success" in result && result.success) {
        setSuccess(result.success);
      }
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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
          {/* Slides */}
          <div className="login-slides">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`login-slide ${index === currentSlide ? "active" : ""}`}
              >
                {/* Placeholder gradient background */}
                <div className="login-slide-placeholder" />
                <div className="login-slide-gradient" />
              </div>
            ))}
          </div>

          {/* Slide content overlay */}
          <div className="login-slide-content">
            <div className="login-slide-badges">
              {currentSlideData.badges.map((badge, i) => (
                <span
                  key={i}
                  className={`login-badge ${badge.variant === "accent" ? "login-badge--accent" : ""}`}
                >
                  {badge.icon === "infinity" && <InfinityIcon />}
                  {badge.icon === "sparkle" && <SparkleIcon />}
                  {badge.icon === "check" && <CheckIcon />}
                  {badge.label}
                </span>
              ))}
            </div>
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
                    className="login-nav-progress-fill"
                    style={{
                      width: index === currentSlide ? `${slideProgress}%` : index < currentSlide ? "100%" : "0%",
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
