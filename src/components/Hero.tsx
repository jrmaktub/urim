import { Sparkles } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-6 py-20">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Logo/Brand */}
        <div className="inline-flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium tracking-wide text-muted-foreground">URIM</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1]">
          Predict the Future.
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Create AI-powered markets where every decision becomes a bet.
        </p>
      </div>
    </section>
  );
};

export default Hero;
