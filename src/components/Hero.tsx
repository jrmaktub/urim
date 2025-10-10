import { Sparkles } from "lucide-react";
import { Button } from "./ui/button";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6">
      {/* Quantum Background Effect */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[128px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 -z-5">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-primary/40 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${6 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Hero Content */}
      <div className="relative z-10 text-center max-w-5xl mx-auto space-y-8 animate-fade-up">
        {/* Logo/Brand */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card glow-primary mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium tracking-wider">URIM</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent animate-shimmer">
            Simulate Every
          </span>
          <br />
          <span className="bg-gradient-to-r from-accent via-primary to-secondary bg-clip-text text-transparent">
            Possible Future
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
          Visualize all quantum paths of your decisions. Predict outcomes. Bet on futures.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
          <Button 
            size="lg" 
            className="text-lg px-8 py-6 rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 glow-primary transition-all duration-300 hover:scale-105"
          >
            Start Simulation
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="text-lg px-8 py-6 rounded-full glass-card border-2 border-primary/30 hover:border-primary/60 hover:bg-primary/10 transition-all duration-300"
          >
            Explore Markets
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-12">
          {[
            { label: "Simulations", value: "10,247" },
            { label: "Active Markets", value: "342" },
            { label: "Total Volume", value: "$2.4M" },
          ].map((stat) => (
            <div key={stat.label} className="space-y-2">
              <div className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
