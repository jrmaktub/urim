const Footer = () => {
  return (
    <footer className="border-t border-border/30 py-12 px-6 mt-32 bg-background/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">U</span>
            </div>
            <span className="text-lg font-bold text-foreground">URIM</span>
          </div>
          
          {/* Copyright */}
          <p className="text-sm text-muted-foreground font-medium">
            © 2025 Urim Protocol. All rights reserved.
          </p>
          
          {/* Tagline */}
          <p className="text-xs text-muted-foreground/60 max-w-md text-center">
            Decentralized prediction markets powered by AI on Base
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
